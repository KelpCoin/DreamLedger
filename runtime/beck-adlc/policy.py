from datetime import datetime, timezone

def evaluate_intent(intent, authority, contract, now=None):
    now = now or datetime.now(timezone.utc)
    if contract.get('status') != 'ACTIVE':
        return {'decision': 'DENY', 'reason_codes': ['INVALID_CONTRACT']}
    if not isinstance(intent, dict) or not all(k in intent for k in ('intent_id','action_type','target','issued_at','idempotency_key','payload','limits')):
        return {'decision': 'DENY', 'reason_codes': ['INVALID_INTENT']}
    if intent.get('action_type') not in contract.get('allowed_action_types', []):
        return {'decision': 'DENY', 'reason_codes': ['ACTION_NOT_ALLOWLISTED']}
    if intent.get('target') not in contract.get('allowed_targets', {}).get(intent.get('action_type'), []):
        return {'decision': 'DENY', 'reason_codes': ['TARGET_OUT_OF_SCOPE']}
    if not isinstance(authority, dict):
        return {'decision': 'DENY', 'reason_codes': ['AUTHORITY_MISSING']}
    if authority.get('state') != 'APPROVED' or authority.get('intent_id') != intent.get('intent_id') or authority.get('action_type') != intent.get('action_type') or authority.get('target') != intent.get('target'):
        return {'decision': 'DENY', 'reason_codes': ['AUTHORITY_SCOPE_MISMATCH']}
    try:
        expires = datetime.fromisoformat(authority['expires_at'].replace('Z', '+00:00'))
        if expires <= now:
            return {'decision': 'DENY', 'reason_codes': ['AUTHORITY_EXPIRED']}
    except (KeyError, ValueError, TypeError):
        return {'decision': 'DENY', 'reason_codes': ['AUTHORITY_INVALID_OR_EXPIRED']}
    for key, ceiling in contract.get('limits', {}).items():
        if key == 'max_payload_bytes':
            continue
        value = intent.get('limits', {}).get(key)
        if not isinstance(value, int) or isinstance(value, bool) or value < 0 or value > ceiling:
            return {'decision': 'DENY', 'reason_codes': ['RESOURCE_LIMIT_EXCEEDED']}
    return {'decision': 'ALLOW', 'reason_codes': ['POLICY_CHECKS_PASSED'], 'contract_id': contract.get('contract_id'), 'intent_id': intent['intent_id'], 'authority_reference': authority.get('reference'), 'idempotency_key': intent['idempotency_key'], 'evaluated_at': now.isoformat()}
