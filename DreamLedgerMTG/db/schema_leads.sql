CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT,
    handle TEXT,
    intent TEXT,
    created_at TEXT
);
