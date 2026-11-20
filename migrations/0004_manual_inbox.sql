CREATE TABLE manual_candidates (
 id TEXT PRIMARY KEY,
 provider TEXT NOT NULL CHECK(provider IN ('twitch','youtube','x')),
 source_id TEXT NOT NULL,
 url TEXT NOT NULL,
 captured_date TEXT NOT NULL,
 created_at TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','reviewed','discarded')),
 title TEXT NOT NULL DEFAULT '',
 streamer TEXT NOT NULL DEFAULT '',
 text TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL DEFAULT 'Fails',
 orientation TEXT NOT NULL DEFAULT 'auto',
 thumbnail TEXT,
 revision INTEGER NOT NULL DEFAULT 1,
 UNIQUE(provider,source_id)
);
CREATE INDEX manual_inbox_recent ON manual_candidates(captured_date DESC,id);
CREATE TABLE manual_selections (
 date TEXT PRIMARY KEY,
 revision INTEGER NOT NULL DEFAULT 1,
 ids TEXT NOT NULL DEFAULT '[]',
 prepared INTEGER NOT NULL DEFAULT 0 CHECK(prepared IN (0,1))
);
CREATE TABLE telegram_receiver (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 cursor INTEGER NOT NULL DEFAULT 0,
 owner TEXT,
 expires_at INTEGER NOT NULL DEFAULT 0,
 date TEXT,
 pending_candidate TEXT,
 pending_field TEXT
);
INSERT INTO telegram_receiver(singleton) VALUES(1);
CREATE TABLE telegram_updates (
 update_id INTEGER PRIMARY KEY,
 processed_at INTEGER NOT NULL
);
CREATE TABLE telegram_outbox (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 update_id INTEGER NOT NULL REFERENCES telegram_updates(update_id),
 payload TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 next_at INTEGER NOT NULL DEFAULT 0,
 delivered INTEGER NOT NULL DEFAULT 0,
 UNIQUE(update_id)
);
CREATE INDEX telegram_outbox_due ON telegram_outbox(delivered,next_at);
CREATE TABLE manual_write_guard (singleton INTEGER PRIMARY KEY CHECK(singleton=1), ok INTEGER NOT NULL CHECK(ok=1));
CREATE TABLE telegram_buttons (
 token TEXT PRIMARY KEY,
 candidate TEXT NOT NULL,
 action TEXT NOT NULL,
 date TEXT NOT NULL,
 selection_revision INTEGER NOT NULL,
 candidate_revision INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
ALTER TABLE telegram_receiver ADD COLUMN pending_revision INTEGER;
