"""Fail-closed kill switch client. Revocation is checked before every protected effect."""
def action_allowed(db, scope: str, target_id: str) -> bool:
    row = db.fetch_one(
        "select 1 from kill_switch_events where scope=%s and target_id=%s and reversed_at is null limit 1",
        (scope, target_id),
    )
    return row is None

def require_action_allowed(db, scope: str, target_id: str) -> None:
    if not action_allowed(db, scope, target_id):
        raise PermissionError(f"kill_switch_active:{scope}:{target_id}")
