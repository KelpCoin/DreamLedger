import os, time, json, requests
from datetime import datetime

ROOT = "C:\\BrownEyeCortex\\CortexBrain"
CONFIG = os.path.join(ROOT, "config.json")
LOGDIR = os.path.join(ROOT, "logs")
LOG = os.path.join(LOGDIR, "brain.log")

def ensure():
    os.makedirs(LOGDIR, exist_ok=True)

def log(msg):
    ensure()
    line = f"[{datetime.now()}] {msg}"
    print(line)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def load_config():
    with open(CONFIG, "r", encoding="utf-8") as f:
        return json.load(f)

def main():
    ensure()
    log("Brain restarted (repaired build)")

    while True:
        try:
            cfg = load_config()

            r = requests.get("http://127.0.0.1:1234/v1/models", timeout=10)
            log(f"LM Studio OK: {r.status_code}")

        except Exception as e:
            log(f"Cycle error: {e}")

        time.sleep(30)

if __name__ == "__main__":
    main()
