import os, re, sys
dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "content", "mtg")
errs = []
for fn in os.listdir(dir):
    path = os.path.join(dir, fn)
    if not (fn.endswith(".mwDeck") or fn.endswith(".mwSingle")): continue
    with open(path) as f: content = f.read()
    if fn.endswith(".mwDeck"):
        if not re.search(r'// NAME :', content): errs.append(f"{fn}: missing NAME")
        if not re.search(r'// COMMANDER :', content): errs.append(f"{fn}: missing COMMANDER")
        lines = [l for l in content.splitlines() if l and not l.startswith("//")]
        if len(lines) != 100: errs.append(f"{fn}: {len(lines)} cards")
if errs:
    print("VALIDATION FAILED")
    for e in errs: print(e)
    sys.exit(1)
print("VALIDATION PASSED")
