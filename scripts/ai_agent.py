import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from env_loader import load_env_file
load_env_file(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
#!/usr/bin/env python3
import json, requests, os

def generate_marketing(commander, cards, price, format_name="Commander"):
    try:
        prompt = f"""You are a Magic: The Gathering copywriter.
Given this Commander deck:
Commander: {commander}
Format: {format_name}
Price: ${price} NZD
Key cards: {', '.join(cards[:10])}

Write a catchy headline and a two-sentence description highlighting the deck's strategy and collector appeal.
Do NOT invent cards, power levels, or tournament results.
Return ONLY valid JSON: {{"headline": "...", "description": "..."}}"""

        resp = requests.post(
            "http://localhost:1234/v1/chat/completions",
            json={
                "model": "local-model",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
                "max_tokens": 200
            },
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            content = data['choices'][0]['message']['content']
            start = content.find('{')
            end = content.rfind('}') + 1
            if start != -1 and end > start:
                return json.loads(content[start:end])
    except:
        pass

    return {
        "headline": f"{commander} Commander Deck",
        "description": f"A {format_name} deck built around {commander}, featuring {', '.join(cards[:3])} and more. Ready to play and priced at ${price} NZD."
    }
