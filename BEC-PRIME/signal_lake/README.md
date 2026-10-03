# Canonical Signal Lake

WORLD -> Bronze -> Gormlet/Silver -> Gold -> Elohim -> Gauntlet -> CUBE -> Economic Loop -> Commerce Cell.

Bronze is immutable. Silver is reconstructible. Gold is promoted and disposable.

Production source: Substack RSS. GitHub is already available through the repository/RAG machinery. Reddit remains a future rail.

The private signal_lake schema is not exposed through the public Data API. Workers write through narrow service-side RPCs.

Required RPCs:
- ingest_bronze_observation(jsonb)
- list_unprocessed_bronze()
- normalize_signal(jsonb)
- promote_gold_signal(jsonb)
