#!/usr/bin/env python3
"""Safe process supervisor for bounded North Star LM Studio cycles."""
from __future__ import annotations
import argparse, json, os, signal, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPT = Path(__file__).resolve()
REPO_ROOT = SCRIPT.parents[2]
CONTROLLER = SCRIPT.with_name("economic_swarm_controller.py")
STOP_REQUESTED = False
DEFAULT_INTERVAL = 300
DEFAULT_TIMEOUT = 900
DEFAULT_MAX_BACKOFF = 1800

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def backoff_seconds(failures: int, maximum: int = DEFAULT_MAX_BACKOFF) -> int:
    if failures <= 0:
        return 0
    return min(maximum, 60 * (2 ** min(failures - 1, 10)))

def parse_cycle_output(stdout: str, returncode: int) -> dict[str, Any]:
    try:
        value = json.loads(stdout.strip())
    except (json.JSONDecodeError, TypeError):
        return {"status":"BLOCKED","reason":"CONTROLLER_OUTPUT_NOT_VALID_JSON","returncode":returncode,"output_tail":stdout[-2000:]}
    if not isinstance(value, dict):
        return {"status":"BLOCKED","reason":"CONTROLLER_OUTPUT_NOT_JSON_OBJECT","returncode":returncode}
    if returncode != 0:
        value["supervisor_observed_status"] = value.get("status","UNKNOWN")
        value["status"] = "BLOCKED"
        value["reason"] = "CONTROLLER_NONZERO_EXIT"
        value["returncode"] = returncode
        return value
    if value.get("status") == "CYCLE_COMPLETE":
        value["supervisor_state"] = "CYCLE_COMPLETE"
        return value
    value["supervisor_state"] = "BLOCKED"
    if value.get("status") != "BLOCKED":
        value["status"] = "BLOCKED"
        value.setdefault("reason","CONTROLLER_STATUS_NOT_RECOGNIZED")
    value["returncode"] = returncode
    return value

def acquire_lock(lock_path: Path):
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    handle = lock_path.open("a+", encoding="utf-8")
    handle.seek(0)
    try:
        if os.name == "nt":
            import msvcrt
            if lock_path.stat().st_size == 0:
                handle.write(" ")
                handle.flush()
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError as exc:
        handle.close()
        raise RuntimeError("SUPERVISOR_ALREADY_RUNNING") from exc
    handle.seek(0)
    handle.truncate()
    handle.write(json.dumps({"pid":os.getpid(),"started_at_utc":utc_now()}) + "\n")
    handle.flush()
    return handle

def release_lock(handle) -> None:
    try:
        if os.name == "nt":
            import msvcrt
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
    except OSError:
        pass
    finally:
        handle.close()

def event(log_path: Path, state: str, **fields: Any) -> None:
    payload = {"timestamp_utc":utc_now(),"state":state,"supervisor_pid":os.getpid(),**fields}
    with log_path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(payload, ensure_ascii=False, separators=(",",":")) + "\n")
    print(json.dumps(payload, ensure_ascii=False), flush=True)

def stop_tree(process: subprocess.Popen, log_path: Path) -> None:
    if process.poll() is not None:
        return
    try:
        if os.name == "nt":
            subprocess.run(["taskkill.exe","/PID",str(process.pid),"/T","/F"],capture_output=True,text=True,timeout=15,check=False)
        else:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
    except (OSError, subprocess.TimeoutExpired) as exc:
        event(log_path,"PROCESS_TREE_STOP_ERROR",controller_pid=process.pid,error=str(exc))
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)

def run_cycle(log_dir: Path, timeout_seconds: int) -> dict[str, Any]:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    stdout_path = log_dir / f"cycle-{stamp}.stdout.json"
    stderr_path = log_dir / f"cycle-{stamp}.stderr.log"
    env = os.environ.copy()
    env.setdefault("DREAMLEDGER_ROOT",str(REPO_ROOT))
    env.setdefault("LM_STUDIO_BASE_URL","http://127.0.0.1:1234")
    command = [sys.executable,"-u",str(CONTROLLER),"--once"]
    with stdout_path.open("w",encoding="utf-8") as out, stderr_path.open("w",encoding="utf-8") as err:
        flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
        proc = subprocess.Popen(command,cwd=str(REPO_ROOT),env=env,stdout=out,stderr=err,creationflags=flags)
        try:
            returncode = proc.wait(timeout=timeout_seconds)
        except subprocess.TimeoutExpired:
            stop_tree(proc, log_dir / "supervisor-events.jsonl")
            return {"status":"BLOCKED","reason":"CONTROLLER_CYCLE_TIMEOUT","controller_pid":proc.pid,"timeout_seconds":timeout_seconds,"stdout_path":str(stdout_path),"stderr_path":str(stderr_path)}
    try:
        stdout = stdout_path.read_text(encoding="utf-8",errors="replace")
    except OSError as exc:
        stdout = ""
        with stderr_path.open("a",encoding="utf-8") as err:
            err.write(f"Could not read controller stdout: {exc}\n")
    result = parse_cycle_output(stdout,returncode)
    result.update({"controller_pid":proc.pid,"stdout_path":str(stdout_path),"stderr_path":str(stderr_path)})
    return result

def request_stop(_signum=None,_frame=None) -> None:
    global STOP_REQUESTED
    STOP_REQUESTED = True

def self_test() -> int:
    assert backoff_seconds(0) == 0
    assert backoff_seconds(1) == 60
    assert backoff_seconds(2) == 120
    assert backoff_seconds(4) == 480
    assert backoff_seconds(50,900) == 900
    good = parse_cycle_output(json.dumps({"status":"CYCLE_COMPLETE","economic_truth":{"verified_external_revenue_nzd":0}}),0)
    assert good["supervisor_state"] == "CYCLE_COMPLETE"
    assert good["economic_truth"]["verified_external_revenue_nzd"] == 0
    blocked = parse_cycle_output(json.dumps({"status":"BLOCKED","reason":"LM_STUDIO_UNAVAILABLE"}),0)
    assert blocked["supervisor_state"] == "BLOCKED"
    assert parse_cycle_output("not json",0)["status"] == "BLOCKED"
    assert parse_cycle_output(json.dumps({"status":"CYCLE_COMPLETE"}),1)["status"] == "BLOCKED"
    print("NORTH_STAR_SUPERVISOR_SELF_TEST=PASS")
    return 0

def main() -> int:
    p = argparse.ArgumentParser(description="Supervise bounded DreamLedger North Star cycles.")
    p.add_argument("--interval-seconds",type=int,default=DEFAULT_INTERVAL)
    p.add_argument("--cycle-timeout-seconds",type=int,default=DEFAULT_TIMEOUT)
    p.add_argument("--max-backoff-seconds",type=int,default=DEFAULT_MAX_BACKOFF)
    p.add_argument("--log-dir",default=os.environ.get("DREAMLEDGER_SUPERVISOR_LOG_DIR",""))
    p.add_argument("--once",action="store_true",help="run one cycle, then exit")
    p.add_argument("--self-test",action="store_true",help="offline supervisor contract tests")
    args = p.parse_args()
    if args.self_test:
        return self_test()
    if args.interval_seconds < 30 or args.cycle_timeout_seconds < 60 or args.max_backoff_seconds < 60:
        p.error("interval >= 30s, cycle timeout >= 60s, and maximum backoff >= 60s are required")
    if not CONTROLLER.is_file():
        print(json.dumps({"state":"BLOCKED","reason":"CONTROLLER_NOT_FOUND","path":str(CONTROLLER)}),file=sys.stderr)
        return 2
    browneye_root = Path(os.environ.get("BROWNEYE_ROOT",r"D:\BrownEyeCortex"))
    if not browneye_root.is_dir():
        browneye_root = REPO_ROOT
    log_dir = Path(args.log_dir).expanduser() if args.log_dir else browneye_root / "LAKE" / "FIGURE8" / "logs" / "NORTH-STAR-SUPERVISOR"
    if not log_dir.is_absolute():
        log_dir = (REPO_ROOT / log_dir).resolve()
    log_dir.mkdir(parents=True,exist_ok=True)
    log_path = log_dir / "supervisor-events.jsonl"
    try:
        lock = acquire_lock(log_dir / "supervisor.lock")
    except RuntimeError as exc:
        print(json.dumps({"timestamp_utc":utc_now(),"state":"BLOCKED","reason":str(exc)}),file=sys.stderr)
        return 3
    signal.signal(signal.SIGINT,request_stop)
    if hasattr(signal,"SIGTERM"):
        signal.signal(signal.SIGTERM,request_stop)
    failures = 0
    cycle_number = 0
    event(log_path,"SUPERVISOR_STARTED",repo_root=str(REPO_ROOT),controller=str(CONTROLLER),python=sys.executable,interval_seconds=args.interval_seconds,cycle_timeout_seconds=args.cycle_timeout_seconds,log_dir=str(log_dir),external_action_performed=False,truth_write_performed=False)
    try:
        while not STOP_REQUESTED:
            cycle_number += 1
            started = time.monotonic()
            event(log_path,"CYCLE_STARTING",cycle_number=cycle_number,external_action_performed=False)
            try:
                result = run_cycle(log_dir,args.cycle_timeout_seconds)
            except Exception as exc:
                result = {"status":"BLOCKED","reason":"SUPERVISOR_CYCLE_EXCEPTION","error":str(exc)}
            if result.get("status") == "CYCLE_COMPLETE" and result.get("supervisor_state") == "CYCLE_COMPLETE":
                failures = 0
                event(log_path,"CYCLE_COMPLETE",cycle_number=cycle_number,result=result,failure_count=0)
                delay = max(0,args.interval_seconds-int(time.monotonic()-started))
            else:
                failures += 1
                delay = backoff_seconds(failures,args.max_backoff_seconds)
                event(log_path,"CYCLE_BLOCKED",cycle_number=cycle_number,result=result,failure_count=failures,retry_in_seconds=delay)
            if args.once or STOP_REQUESTED:
                break
            deadline = time.monotonic()+delay
            while not STOP_REQUESTED and time.monotonic()<deadline:
                time.sleep(min(1.0,deadline-time.monotonic()))
    except KeyboardInterrupt:
        request_stop()
    finally:
        event(log_path,"SUPERVISOR_STOPPED",clean=True)
        release_lock(lock)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
