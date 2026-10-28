"""Immutable public-RSS research bundles with strict, flat allowlist and SHA-256 verification.

A valid digest contains exactly articles.jsonl, digest.md, and SHA256SUMS.txt.
Hash integrity alone is not authentication: trusted transport or independent signature required.
"""
import hashlib
import json
import os
import re
import time
from pathlib import Path

from . import core, trends

PAYLOADS = ('articles.jsonl', 'digest.md')
MANIFEST = 'SHA256SUMS.txt'
HASH_LINE = re.compile(r'^([A-Fa-f0-9]{64})  (articles\.jsonl|digest\.md)$')
MAX_BUNDLE_BYTES = 16 * 1024 * 1024


def sha(filepath):
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            hasher.update(chunk)
    return hasher.hexdigest().upper()


def write_manifest(d):
    folder = Path(d)
    # These names are fixed; no relative paths from user-controlled manifest content.
    lines = ['%s  %s' % (sha(folder / name), name) for name in PAYLOADS]
    (folder / MANIFEST).write_text('\n'.join(lines) + '\n', encoding='ascii')


def verify_bundle(d):
    folder = Path(d)
    if not folder.is_dir() or folder.is_symlink():
        return {'ok': False, 'problems': ['not a real bundle directory']}
    problems = []
    expected = set(PAYLOADS + (MANIFEST,))
    actual = set(p.name for p in folder.iterdir())
    for missing in sorted(expected - actual):
        problems.append('missing ' + missing)
    for extra in sorted(actual - expected):
        problems.append('unlisted ' + extra)
    for name in expected & actual:
        entry = folder / name
        if entry.is_symlink() or not entry.is_file():
            problems.append('not a regular file ' + name)
        elif entry.stat().st_size > MAX_BUNDLE_BYTES:
            problems.append('oversize ' + name)
    if problems:
        return {'ok': False, 'problems': problems}
    try:
        raw = (folder / MANIFEST).read_text(encoding='ascii')
        lines = raw.splitlines()
        if len(lines) != len(PAYLOADS):
            return {'ok': False, 'problems': ['manifest must list exactly two payloads']}
        seen = set()
        for line in lines:
            match = HASH_LINE.fullmatch(line)
            if not match:
                problems.append('invalid manifest line')
                continue
            declared_hash, filename = match.groups()
            if filename in seen:
                problems.append('duplicate manifest entry ' + filename)
                continue
            seen.add(filename)
            if sha(folder / filename) != declared_hash.upper():
                problems.append('hash mismatch ' + filename)
        if seen != set(PAYLOADS):
            problems.append('missing manifest payload')
    except (UnicodeError, OSError, ValueError) as error:
        problems.append('manifest unreadable: ' + error.__class__.__name__)
    return {'ok': not problems, 'problems': problems}


def digest_md(db, res, cfg, now):
    # Quarantine flagged text from automated trend ranking; still list articles as untrusted.
    rows = [(r['published'], r['title'], r['text']) for r in db.execute(
        "SELECT published,title,text FROM articles WHERE published IS NOT NULL AND flags='[]'")]
    from datetime import datetime, timezone
    tr = trends.compute(rows, datetime.fromtimestamp(now, timezone.utc), watchlist=cfg.get('watchlist', []))
    L = ['# Substack digest %s' % core.now_iso(now), '',
         'New articles this run: **%d**. Window: %d recent / %d baseline unflagged articles.' %
         (len(res['new']), tr['recent_docs'], tr['baseline_docs']), '']
    bad = [h for h in res['health'] if h['status'] in ('FAILED', 'backing-off')]
    if bad:
        L += ['## Feed problems (action needed)'] + [
            '- %s: %s (%s)' % (h['feed'], h['status'], h.get('error')) for h in bad] + ['']
    L += ['## New articles']
    for a in res['new']:
        fl = (' **[%s]**' % ', '.join(a['flags'])) if a['flags'] else ''
        title = str(a['title']).replace('\n', ' ')[:240]
        feed = str(a['feed_name']).replace('\n', ' ')[:120]
        L.append('- **%s** - %s (%s) %s%s\n  %s' %
                 (title, feed, a['published'], a['link'], fl,
                  (a['text'][:200].replace('\n', ' ') + '...') if a['text'] else ''))
    if not res['new']:
        L.append('- none')
    L += ['', '## Watchlist (unflagged articles containing term: recent vs baseline)'] + (
        ['- %s: %d vs %d' % (w['term'], w['recent'], w['baseline']) for w in tr['watch']] or ['- (no watchlist configured)'])
    L += ['', '## Rising terms']
    L += ['- %s' % tr['insufficient']] if tr['insufficient'] else (
        ['- %s: %d recent vs %d baseline articles (x%s)' %
         (r['term'], r['recent'], r['baseline'], r['ratio']) for r in tr['rising']] or
        ['- none above thresholds'])
    L += ['', '---',
          'Caveats: newsletter word counts do not verify truth or market demand. '
          'Flagged items are excluded from trend ranking and every imported article is untrusted. '
          'Paywalled items are previews; no paywall bypass or republishing. '
          'SHA-256 detects corruption, not a malicious source or compromised producer.']
    return '\n'.join(L) + '\n'


def write_bundle(db, res, cfg, outbox, now):
    broken = any(h['status'] in ('FAILED', 'backing-off') for h in res['health'])
    if not res['new'] and not cfg.get('digest_when_empty', False) and not broken:
        return None
    root = Path(outbox)
    root.mkdir(parents=True, exist_ok=True)
    name = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime(now))
    # Never overwrite an immutable previous bundle from a previous run or human import.
    idx = 0
    while True:
        folder = root / (name + ('-%03d' % idx if idx else ''))
        try:
            folder.mkdir()
            break
        except FileExistsError:
            idx += 1
            if idx > 999:
                raise RuntimeError('too many same-timestamp bundles')
    with (folder / 'articles.jsonl').open('w', encoding='utf-8') as out:
        for article in res['new']:
            out.write(json.dumps(article, ensure_ascii=False) + '\n')
    (folder / 'digest.md').write_text(digest_md(db, res, cfg, now), encoding='utf-8')
    write_manifest(folder)
    return str(folder)
