#!/usr/bin/env python3
"""Deterministic Commander diagnostic analyzer plus LM Studio narrative client.
No payment, fulfillment, or truth state is mutated here.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

SCRYFALL = "https://api.scryfall.com"
CACHE_DAYS = 30


def http_json(url, method="GET", payload=None, timeout=30):
    data = None
    headers = {"User-Agent": "DreamLedger-CommanderDiagnostic/1.0"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def load_cache(path):
    try:
        if time.time() - path.stat().st_mtime <= CACHE_DAYS * 86400:
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}


def save_cache(path, cache):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")


def parse_decklist(text):
    cards = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("//") or line.startswith("#"):
            continue
        m = re.match(r"^(\d+)\s*[xX]?\s+(.+?)(?:\s*\[[^\]]+\])?$", line)
        if not m:
            m = re.match(r"^(\d+)[xX](.+)$", line)
        if not m:
            continue
        qty = int(m.group(1))
        name = m.group(2).strip()
        if qty > 0 and name:
            cards.append({"count": qty, "name": name})
    return cards


def fetch_cards(cards, cache_path):
    cache = load_cache(cache_path)
    result = {}
    pending = []
    for c in cards:
        key = c["name"].lower()
        if key in cache:
            result[key] = cache[key]
        else:
            pending.append(c["name"])
    for i in range(0, len(pending), 75):
        batch = pending[i:i+75]
        payload = {"identifiers": [{"name": n} for n in batch]}
        data = http_json(SCRYFALL + "/cards/collection", "POST", payload)
        for card in data.get("data", []):
            cache[card["name"].lower()] = card
            result[card["name"].lower()] = card
        for miss in data.get("not_found", []):
            n = miss.get("name", "")
            cache[n.lower()] = {"not_found": True, "name": n}
            result[n.lower()] = cache[n.lower()]
    save_cache(cache_path, cache)
    return result


def analyze(text, cache_path):
    entries = parse_decklist(text)
    cards = fetch_cards(entries, cache_path)
    totals = {"cards_listed": sum(x["count"] for x in entries), "unique_names": len(entries), "unresolved_names": 0}
    type_counts = {}
    colors = {}
    cmc = {}
    lands = ramp = draw = interaction = board_wipes = tutors = creatures = 0
    commanders = []
    for e in entries:
        c = cards.get(e["name"].lower(), {"not_found": True, "name": e["name"]})
        q = e["count"]
        if c.get("not_found"):
            totals["unresolved_names"] += q
            continue
        types = c.get("type_line", "")
        oracle = (c.get("oracle_text") or "").lower()
        for t in types.split(" — ")[0].split(" "):
            type_counts[t] = type_counts.get(t, 0) + q
        if "Land" in types:
            lands += q
        if "Creature" in types:
            creatures += q
        if c.get("color_identity"):
            for color in c["color_identity"]:
                colors[color] = colors.get(color, 0) + q
        cmc_key = str(c.get("cmc", 0))
        cmc[cmc_key] = cmc.get(cmc_key, 0) + q
        if any(k in oracle for k in ["add {", "add one mana", "search your library for a basic land"]):
            ramp += q
        if any(k in oracle for k in ["draw a card", "draw two cards", "draw three cards"]):
            draw += q
        if any(k in oracle for k in ["destroy target", "exile target", "counter target", "return target"]):
            interaction += q
        if any(k in oracle for k in ["destroy all", "exile all", "each creature gets", "all creatures"]):
            board_wipes += q
        if "search your library" in oracle:
            tutors += q
    facts = {
        "totals": totals,
        "lands": lands,
        "creatures": creatures,
        "ramp_heuristic": ramp,
        "draw_heuristic": draw,
        "interaction_heuristic": interaction,
        "board_wipes_heuristic": board_wipes,
        "tutors_heuristic": tutors,
        "color_identity_frequency": colors,
        "type_counts": type_counts,
        "mana_value_distribution": cmc,
        "unresolved_examples": [x["name"] for x in entries if cards.get(x["name"].lower(), {}).get("not_found")][:20],
    }
    return facts


def lm_narrative(facts, model, base_url):
    prompt = (
        "You are the narrative layer for a deterministic Commander deck diagnostic. "
        "Do not invent card facts. Treat every numeric field below as measured. "
        "Clearly label heuristic classifications as heuristics. Return JSON with keys "
        "summary, strengths, risks, recommendations, caveats.\n\nFACTS:\n" +
        json.dumps(facts, ensure_ascii=False)
    )
    body = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.2, "response_format": {"type": "json_object"}}
    data = http_json(base_url.rstrip("/") + "/chat/completions", "POST", body, timeout=120)
    content = data["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    for key in ["summary", "strengths", "risks", "recommendations", "caveats"]:
        if key not in parsed:
            raise ValueError("LM output missing key: " + key)
    return parsed


def main():
    if len(sys.argv) != 4:
        print("usage: CommanderDiagnosticAnalyzer.py <decklist.txt> <output.json> <report.md>", file=sys.stderr)
        return 2
    deck_path, out_path, report_path = map(Path, sys.argv[1:])
    text = deck_path.read_text(encoding="utf-8")
    cache_path = Path(os.environ.get("SCRYFALL_CACHE", str(deck_path.parent / "scryfall_cache.json")))
    facts = analyze(text, cache_path)
    model = os.environ.get("LM_STUDIO_MODEL", "qwen2.5-14b-instruct")
    base = os.environ.get("LM_STUDIO_BASE_URL", "http://127.0.0.1:1234/v1")
    narrative = lm_narrative(facts, model, base)
    result = {"schema": "DREAMLEDGER-COMMANDER-DIAGNOSTIC/v1", "facts": facts, "narrative": narrative, "model": model, "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    lines = ["# Commander Deck Diagnostic", "", "## Measured facts", "", "```json", json.dumps(facts, indent=2, ensure_ascii=False), "```", "", "## Diagnostic", "", narrative["summary"], ""]
    for section in ["strengths", "risks", "recommendations", "caveats"]:
        lines.append("### " + section.replace("_", " ").title())
        vals = narrative[section] if isinstance(narrative[section], list) else [narrative[section]]
        lines.extend("- " + str(v) for v in vals)
        lines.append("")
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
