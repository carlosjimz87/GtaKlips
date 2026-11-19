CREATE TABLE candidates (
 id TEXT PRIMARY KEY,
 url TEXT NOT NULL,
 streamer TEXT NOT NULL,
 title TEXT NOT NULL,
 language TEXT NOT NULL,
 game_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 duration REAL NOT NULL,
 views INTEGER NOT NULL,
 observed_at TEXT NOT NULL,
 review_state TEXT NOT NULL DEFAULT 'pending' CHECK(review_state IN ('pending','selected','rejected'))
);
CREATE TABLE import_runs (
 id TEXT PRIMARY KEY,
 trigger TEXT NOT NULL CHECK(trigger IN ('manual','cron')),
 status TEXT NOT NULL CHECK(status IN ('running','success','empty','partial','error','skipped')),
 started_at TEXT NOT NULL,
 finished_at TEXT,
 window_start TEXT NOT NULL,
 window_end TEXT NOT NULL,
 requests INTEGER NOT NULL DEFAULT 0,
 pages INTEGER NOT NULL DEFAULT 0,
 found INTEGER NOT NULL DEFAULT 0,
 saved INTEGER NOT NULL DEFAULT 0,
 game_id TEXT,
 game_name TEXT,
 error_code TEXT
);
CREATE INDEX import_runs_recent ON import_runs(started_at DESC);
CREATE INDEX candidates_recent ON candidates(created_at DESC, id);
CREATE TABLE import_lease (
 name TEXT PRIMARY KEY CHECK(name = 'twitch'),
 owner TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
