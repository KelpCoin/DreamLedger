"""Offline import: strict hash and record checks, no article text promoted into agent instructions."""
import hashlib
import json
import os
import re
from pathlib import Path
from . import core, bundle

ARTICLE_ID = re.compile(r'^[0-9a-f]{64}$')
REQUIRED = ('id', 'feed_url', 'feed_name', 'title', 'author', 'published', 'link',
            'text', 'text_sha256', 'flags', 'fetched_at')


def validate_record(article):
    if not isinstance(article, dict) or any(key not in article for key in REQUIRED):
        raise ValueError('invalid article schema')
    if not isinstance(article['id'], str) or not ARTICLE_ID.fullmatch(article['id']):
        raise ValueError('invalid article id')
    if not isinstance(article['text'], str) or not isinstance(article['flags'], list):
        raise ValueError('invalid text or flags')
    if not all(isinstance(article[key], str) or article[key] is None for key in
               ('feed_url', 'feed_name', 'title', 'author', 'published', 'link', 'fetched_at')):
        raise ValueError('invalid metadata')
    if not isinstance(article['text_sha256'], str) or not ARTICLE_ID.fullmatch(article['text_sha256']):
        raise ValueError('invalid content hash')
    if hashlib.sha256(article['text'].encode('utf-8')).hexdigest() != article['text_sha256']:
        raise ValueError('article text hash mismatch')
    if len(article['text']) > 2_000_000:
        raise ValueError('article text too long')
    return article


def import_bundle(bundle_dir, kb_dir):
    verified = bundle.verify_bundle(bundle_dir)
    if not verified['ok']:
        raise ValueError('bundle failed verification: %s' % verified['problems'])
    articles = []
    with open(os.path.join(bundle_dir, 'articles.jsonl'), encoding='utf-8') as stream:
        for line in stream:
            if line.strip():
                articles.append(validate_record(json.loads(line)))
            if len(articles) > 500:
                raise ValueError('too many articles in bundle')
    root = Path(kb_dir)
    (root / 'articles').mkdir(parents=True, exist_ok=True)
    db = core.open_db(str(root / 'kb.sqlite'))
    added = skipped = 0
    try:
        for a in articles:
            if db.execute('SELECT 1 FROM articles WHERE id=?', (a['id'],)).fetchone():
                skipped += 1
                continue
            db.execute('INSERT INTO articles VALUES(?,?,?,?,?,?,?,?,?,?,?)',
                       (a['id'], a['feed_url'], a['feed_name'], a['title'], a['author'],
                        a['published'], a['link'], a['text'], a['text_sha256'],
                        json.dumps(a['flags']), a['fetched_at']))
            # Filename comes from validated lower-case SHA256 only. Untrusted strings are
            # JSON-quoted in YAML frontmatter, not interpreted as frontmatter delimiters.
            front = ['---'] + [key + ': ' + json.dumps(a.get(key), ensure_ascii=False) for key in
                              ('title', 'feed_name', 'feed_url', 'link', 'published', 'flags')]
            front += ['untrusted: true', 'trust_level: external_public_rss',
                      'agent_tool_authority: none', 'human_approval_required: true', '---', '']
            file = root / 'articles' / (a['id'] + '.md')
            try:
                with file.open('x', encoding='utf-8') as out:
                    out.write('\n'.join(front) + '\n' + a['text'] + '\n')
            except FileExistsError:
                # Refuse to overwrite an existing conflicting hand-curated note.
                raise ValueError('existing KB article file requires reconciliation')
            added += 1
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    return {'added': added, 'skipped': skipped}
