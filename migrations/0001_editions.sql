CREATE TABLE editions (
 date TEXT PRIMARY KEY,
 revision INTEGER NOT NULL DEFAULT 1,
 draft TEXT NOT NULL,
 published TEXT,
 published_at TEXT
);
