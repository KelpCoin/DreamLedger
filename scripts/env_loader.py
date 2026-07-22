import os

def load_env_file(path=".env"):
    if not os.path.exists(path):
        return

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line=line.strip()

            if not line:
                continue

            if line.startswith("#"):
                continue

            if "=" not in line:
                continue

            k,v=line.split("=",1)

            k=k.strip()
            v=v.strip().strip('"').strip("'")

            if k and not os.environ.get(k):
                os.environ[k]=v
