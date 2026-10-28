"""Export aggregate, read-only evidence for BECK without article content or decision authority."""
import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from . import privacy


def build_kb_evidence(kb_dir):
    privacy.require_private_path(kb_dir, "BECK personal research knowledge base")
    root = Path(kb_dir)
    db_file = root / 'kb.sqlite'
    if not db_file.is_file() or db_file.is_symlink():
        raise ValueError('valid imported knowledge base is required')
    connection = sqlite3.connect('file:' + str(db_file.resolve()) + '?mode=ro', uri=True)
    try:
        records = connection.execute('SELECT id, feed_url, text_sha256, flags FROM articles ORDER BY id').fetchall()
        feeds = connection.execute('SELECT COUNT(DISTINCT feed_url) FROM articles').fetchone()[0]
    finally:
        connection.close()
    h = hashlib.sha256()
    flagged = 0
    for aid, url, digest, raw_flags in records:
        flags = json.loads(raw_flags)
        flagged += bool(flags)
        h.update((aid + '\0' + digest + '\0' + url + '\n').encode('utf-8'))
    return {
        'schema': 'beck/public-rss-research-snapshot/v1',
        'classification': privacy.POLICY['classification'],
        'truth_oracle_auto_publication': False,
        'allowed_website_surface': None,
        'generated_utc': datetime.now(timezone.utc).isoformat(),
        'source_type': 'public_substack_rss',
        'origin': 'offline-verified-substack_ingest-import',
        'article_count': len(records), 'source_count': feeds,
        'flagged_article_count': flagged,
        'source_record_digest_sha256': h.hexdigest(),
        'source_text_included': False,
        'trend_level': 'WEAK_HYPOTHESIS_ONLY',
        'trust': 'UNTRUSTED_EXTERNAL_RESEARCH',
        'llm_tool_access': False,
        'may_promote_to_commercial_decision': False,
        'may_trigger_checkout_or_publication': False,
        'promotion_requires': ['independent_record', 'founder_approval'],
    }


def export_kb_evidence(kb_dir, output_path):
    result = build_kb_evidence(kb_dir)
    output = Path(privacy.require_private_path(output_path, "BECK internal research evidence"))
    if output.is_symlink():
        raise ValueError('cannot overwrite evidence through symlink')
    output.parent.mkdir(parents=True, exist_ok=True)
    # Owner can read this JSON without the articles themselves.
    output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    return result
