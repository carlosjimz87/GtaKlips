ALTER TABLE manual_candidates ADD COLUMN automatic INTEGER NOT NULL DEFAULT 0;
ALTER TABLE manual_candidates ADD COLUMN field_sources TEXT NOT NULL DEFAULT '{}';
CREATE TABLE capture_batches (
 id TEXT PRIMARY KEY,
 date TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 notified INTEGER NOT NULL DEFAULT 0,
 notify INTEGER NOT NULL DEFAULT 0,
 saved INTEGER NOT NULL,
 duplicates INTEGER NOT NULL,
 rejected INTEGER NOT NULL,
 overflow INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE capture_members (
 batch TEXT NOT NULL REFERENCES capture_batches(id),
 candidate TEXT NOT NULL REFERENCES manual_candidates(id),
 PRIMARY KEY(batch,candidate)
);
CREATE TABLE auto_buttons (
 token TEXT PRIMARY KEY,
 date TEXT NOT NULL,
 action TEXT NOT NULL,
 payload TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE TABLE auto_input (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 candidate TEXT NOT NULL,
 field TEXT NOT NULL,
 revision INTEGER NOT NULL,
 date TEXT NOT NULL
);
/* Complete previews can span messages without truncation. */
ALTER TABLE telegram_outbox RENAME TO telegram_outbox_old;
CREATE TABLE telegram_outbox (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 update_id INTEGER NOT NULL REFERENCES telegram_updates(update_id),
 payload TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 next_at INTEGER NOT NULL DEFAULT 0,
 delivered INTEGER NOT NULL DEFAULT 0,
 part INTEGER NOT NULL DEFAULT 0,
 UNIQUE(update_id,part)
);
INSERT INTO telegram_outbox(id,update_id,payload,attempts,next_at,delivered)
 SELECT id,update_id,payload,attempts,next_at,delivered FROM telegram_outbox_old;
DROP TABLE telegram_outbox_old;
CREATE INDEX telegram_outbox_due ON telegram_outbox(delivered,next_at);

ALTER TABLE manual_candidates ADD COLUMN capture_origin TEXT NOT NULL DEFAULT 'manual';
CREATE TABLE processing_health (singleton INTEGER PRIMARY KEY CHECK(singleton=1),last_seen INTEGER NOT NULL,model_configured INTEGER NOT NULL);
