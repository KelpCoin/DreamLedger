{
  "schema": "dreamledger.wanted-items/v1",
  "purpose": "Private, cross-silo wanted-item tracking for authenticated users. Records may represent physical goods, media, collectibles, services, experiences, or any other user-defined target.",
  "privacy": "OWNER_ONLY",
  "fields": {
    "id": "uuid",
    "owner_user_id": "uuid",
    "silo_id": "string",
    "title": "string",
    "target_type": "string",
    "target_reference": "string|null",
    "edition_or_variant": "string|null",
    "condition_min": "string|null",
    "max_price_nzd": "number|null",
    "notes_private": "string|null",
    "priority": "LOW|NORMAL|HIGH|HOLY_GRAIL",
    "status": "WANTED|WATCHING|FOUND|PURCHASED|PAUSED|RETIRED",
    "alert_policy": "IMMEDIATE|DAILY|WEEKLY|OFF",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  },
  "security": {
    "owner_rule": "owner_user_id must equal auth.uid() for private rows",
    "authorization_source": "database RLS, not user-editable metadata",
    "cross_user_reads": false,
    "cross_user_writes": false,
    "public_demand_aggregation": "derived aggregate only; never expose individual private wanted rows",
    "paid_signal_access": "entitlement checked server-side; never trusted from user_metadata"
  }
}
