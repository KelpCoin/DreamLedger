import json
import os
import sys
from query import query

CASES = [
    {
        'case_id': 'RAG-001-COMMERCIAL-STATE',
        'query': 'What is the current verified commercial state of DreamLedger?',
        'required_terms': ['DreamLedger'],
        'required_sources': ['github.com/KelpCoin/DreamLedger']
    },
    {
        'case_id': 'RAG-002-PROMOTION-GATE',
        'query': 'What is the production promotion gate and how does the 24 hour delay work?',
        'required_terms': ['promotion'],
        'required_sources': ['github.com/KelpCoin/DreamLedger']
    }
]

fail = 0
for case in CASES:
    try:
        results = query(case['query'], 8)
        text = '\n'.join(str(r) for r in results).lower()
        missing_terms = [x for x in case['required_terms'] if x.lower() not in text]
        missing_sources = [x for x in case['required_sources'] if x.lower() not in text]
        ok = not missing_terms and not missing_sources and len(results) > 0
        print(json.dumps({'case_id': case['case_id'], 'status': 'PASS' if ok else 'FAIL', 'result_count': len(results), 'missing_terms': missing_terms, 'missing_sources': missing_sources}))
        if not ok:
            fail += 1
    except Exception as exc:
        print(json.dumps({'case_id': case['case_id'], 'status': 'ERROR', 'error': str(exc)}))
        fail += 1

print(json.dumps({'status': 'PASS' if fail == 0 else 'FAIL', 'cases': len(CASES), 'failures': fail}))
sys.exit(1 if fail else 0)
