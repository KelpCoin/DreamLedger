"""Trend digest from document frequency. Deterministic, no LLM. Term frequency is a signal of attention, not of truth."""
import math, re
from datetime import datetime, timedelta, timezone

STOP = set("""a about above after again all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its just like me more most my new no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who why will with would you your one two three get got make made use used using says said say way even still much many may might also really every first last next time year years week day days post article newsletter subscribe read share comment comments click link email""".split())
TOK = re.compile(r"[a-z][a-z0-9\-\+\.]{2,}")


def terms(text):
    ws = [w.strip(".-") for w in TOK.findall(text.lower())]; ws = [w for w in ws if len(w) > 2 and w not in STOP and not w.isdigit()]
    s = set(ws)
    s |= {a + " " + b for a, b in zip(ws, ws[1:])}
    return s


def compute(rows, now, recent_days=7, base_days=28, min_recent=3, min_r_docs=5, min_b_docs=10, top=15, watchlist=()):
    """rows: iterable of (published_iso, title, text). Returns dict with rising terms or an 'insufficient' explanation."""
    t = lambda s: datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    r0 = now - timedelta(days=recent_days); b0 = r0 - timedelta(days=base_days)
    R, B = [], []
    for pub, title, text in rows:
        if not pub: continue
        d = t(pub); (R if d >= r0 else B if d >= b0 else []).append(terms(title + " " + title + " " + text[:6000]))
    out = dict(recent_docs=len(R), baseline_docs=len(B), rising=[], watch=[], insufficient=None)
    wl = [w.lower() for w in watchlist]
    cnt = lambda docs, term: sum(1 for d in docs if term in d)
    out["watch"] = [dict(term=w, recent=cnt(R, w), baseline=cnt(B, w)) for w in wl]
    if len(R) < min_r_docs or len(B) < min_b_docs:
        out["insufficient"] = "need >=%d recent and >=%d baseline articles (have %d / %d); rising terms withheld" % (min_r_docs, min_b_docs, len(R), len(B)); return out
    rc, bc = {}, {}
    for d in R:
        for x in d: rc[x] = rc.get(x, 0) + 1
    for d in B:
        for x in d: bc[x] = bc.get(x, 0) + 1
    sc = []
    for x, r in rc.items():
        if r < min_recent: continue
        b = bc.get(x, 0); ratio = ((r + .5) / (len(R) + 1)) / ((b + .5) / (len(B) + 1))
        if ratio > 1.5: sc.append((ratio * math.log(1 + r), x, r, b, ratio))
    out["rising"] = [dict(term=x, recent=r, baseline=b, ratio=round(ra, 1)) for _, x, r, b, ra in sorted(sc, reverse=True)[:top]]
    return out
