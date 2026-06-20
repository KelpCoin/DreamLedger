import os, json, time, subprocess, requests, random, shutil
from datetime import datetime
from pathlib import Path

# ======= CONFIG =======
DOCTRINE_PATH = r"D:\ChatGPT_Export"          # <-- CHANGE TO YOUR ACTUAL EXPORT FOLDER
QR_CODE_URL   = "https://dreamledger.org/store.html"
LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions"
CORTEX_ROOT   = r"C:\BrownEyeCortex"
SOCIAL_CREDS  = {
    "tumblr": {
        "consumer_key": "YOUR_KEY",
        "consumer_secret": "YOUR_SECRET",
        "oauth_token": "YOUR_TOKEN",
        "oauth_secret": "YOUR_TOKEN_SECRET",
        "blog_identifier": "yourblog.tumblr.com"
    },
    "reddit": {
        "client_id": "YOUR_ID",
        "client_secret": "YOUR_SECRET",
        "user_agent": "CortexBrain/1.0",
        "username": "YOUR_REDDIT_USER",
        "password": "YOUR_REDDIT_PASS"
    }
}

# ======= LOAD DOCTRINE =======
def load_doctrine():
    docs = []
    for file in Path(DOCTRINE_PATH).rglob("*.txt"):
        with open(file, 'r', encoding='utf-8', errors='ignore') as f:
            docs.append(f.read())
    return "\n\n".join(docs)

# ======= LM STUDIO BRAIN =======
def ask_brain(prompt, context=""):
    full_context = f"SYSTEM DOCTRINE:\n{context}\n\nINSTRUCTION: {prompt}"
    payload = {
        "model": "local-model",  # LM Studio will use whatever is loaded
        "messages": [
            {"role": "system", "content": "You are Cortex Brain, the strategic core of a multi-million-dollar autonomous business. You have access to all operating doctrines. Make aggressive, profit-maximising decisions."},
            {"role": "user", "content": full_context}
        ],
        "temperature": 0.7,
        "max_tokens": 800
    }
    try:
        resp = requests.post(LM_STUDIO_URL, json=payload, timeout=120)
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"Brain error: {e}")
        return None

# ======= POST TO TUMBLR =======
def post_to_tumblr(content, tags=None):
    try:
        import pytumblr
        client = pytumblr.TumblrRestClient(
            SOCIAL_CREDS["tumblr"]["consumer_key"],
            SOCIAL_CREDS["tumblr"]["consumer_secret"],
            SOCIAL_CREDS["tumblr"]["oauth_token"],
            SOCIAL_CREDS["tumblr"]["oauth_secret"]
        )
        client.create_text(
            SOCIAL_CREDS["tumblr"]["blog_identifier"],
            body=f"{content}\n\n{QR_CODE_URL}",
            tags=tags or ["MTG", "Commander", "DigitalProduct", "QR", "DreamLedger"]
        )
        print("Posted to Tumblr.")
    except Exception as e:
        print(f"Tumblr failed: {e}")

# ======= POST TO REDDIT =======
def post_to_reddit(subreddit, title, body):
    try:
        import praw
        reddit = praw.Reddit(
            client_id=SOCIAL_CREDS["reddit"]["client_id"],
            client_secret=SOCIAL_CREDS["reddit"]["client_secret"],
            user_agent=SOCIAL_CREDS["reddit"]["user_agent"],
            username=SOCIAL_CREDS["reddit"]["username"],
            password=SOCIAL_CREDS["reddit"]["password"]
        )
        reddit.subreddit(subreddit).submit(title, body + f"\n\n{QR_CODE_URL}")
        print("Posted to Reddit.")
    except Exception as e:
        print(f"Reddit failed: {e}")

# ======= GENERATE & DISTRIBUTE QR CODE =======
def generate_qr_image():
    import qrcode
    img = qrcode.make(QR_CODE_URL)
    img_path = os.path.join(CORTEX_ROOT, "assets", "dreamledger_qr.png")
    img.save(img_path)
    return img_path

def print_qr_code():
    img_path = os.path.join(CORTEX_ROOT, "assets", "dreamledger_qr.png")
    if os.name == 'nt':
        subprocess.run(["mspaint", "/p", img_path], shell=True)
        print("QR code sent to printer.")

# ======= ORCHESTRATOR =======
def main():
    doctrine = load_doctrine()
    print("Brain online. Doctrine loaded.")

    while True:
        print(f"\n=== Brain Cycle {datetime.now()} ===")

        # 1. Run Cortex PowerShell pipeline (existing)
        subprocess.run(["powershell", "-File", os.path.join(CORTEX_ROOT, "RUN-REVENUE.ps1")], shell=True)

        # 2. Ask brain to generate a new post
        prompt = f"Generate a compelling Tumblr post (max 300 chars) to sell MTG Commander decks or digital artifacts. Include a reason to scan the QR code. Use the following doctrine for tone and style."
        post_content = ask_brain(prompt, doctrine)
        if post_content:
            # 3. Post to Tumblr
            post_to_tumblr(post_content)
            # 4. Post to Reddit (r/mtgfinance)
            post_to_reddit("mtgfinance", "Exclusive Commander Deck Deals", post_content)

        # 5. Ensure QR code exists
        qr_path = generate_qr_image()
        print(f"QR code ready: {qr_path}")

        # 6. Print QR code once per day (optional)
        # Uncomment next line if printer is available:
        # print_qr_code()

        # 7. Wait 6 hours before next cycle
        time.sleep(21600)

if __name__ == "__main__":
    main()