# North Star local supervisor

This wrapper supervises one bounded economic_swarm_controller.py --once run per cycle. A historical three-model inference PASS does not prove a job is currently executing.

## Behavior

- Runs one bounded controller cycle, then waits for the configured interval (default 300 seconds).
- Only CYCLE_COMPLETE counts as a completed controller cycle. BLOCKED, malformed output, a nonzero exit, or a timeout remain blocked.
- Writes separate stdout and stderr files per attempt plus an append-only JSONL event log.
- Uses D:\BrownEyeCortex\LAKE\FIGURE8\logs\NORTH-STAR-SUPERVISOR when that root exists; otherwise it logs under the repository's LAKE/FIGURE8/logs/NORTH-STAR-SUPERVISOR folder.
- Prevents duplicate supervisors with an OS-level exclusive lock.
- Stops only the controller process tree it launched if that cycle exceeds the timeout.
- Retries blocked cycles with exponential backoff, capped at 30 minutes.
- Stops cleanly on Ctrl+C or a scheduled-task stop.

## Safety boundary

The supervisor does not launch LM Studio, install models, create checkout sessions, charge cards, contact buyers, publish external content, change credentials, write to Supabase, or edit revenue truth. It reports the controller result without converting model decisions into payment or fulfillment claims. Internal artifacts remain reviewable outputs, not evidence of revenue.

## Offline self-test

From the repository root, run:

    python .\runtime\lm_studio\north_star_supervisor.py --self-test

## Preview the Windows logon task installer

This preview performs the offline self-test but does not register or start a scheduled task:

    powershell -NoProfile -ExecutionPolicy Bypass -File .\runtime\lm_studio\Install-NorthStarSupervisorTask.ps1

To register a logon task and request an immediate start, run the installer once with -Install:

    powershell -NoProfile -ExecutionPolicy Bypass -File .\runtime\lm_studio\Install-NorthStarSupervisorTask.ps1 -Install

This one local invocation remains necessary because ChatGPT has no process-control access to the Windows computer. The task runs as the current interactive user with limited privilege and does not require administrator elevation. Its state remains CONTINUOUS_EXECUTION_NOT_ESTABLISHED until logs show a genuine CYCLE_COMPLETE with three distinct model roles recorded by the controller.
