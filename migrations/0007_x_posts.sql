CREATE TABLE x_posts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 kind TEXT NOT NULL CHECK(kind IN ('top','creator_hunt')),
 ref TEXT NOT NULL,
 text TEXT NOT NULL,
 reply_text TEXT NOT NULL DEFAULT '',
 state TEXT NOT NULL CHECK(state IN ('publishing','published','failed')),
 tweet_id TEXT,
 error TEXT,
 created_at TEXT NOT NULL,
 UNIQUE(kind,ref)
);
