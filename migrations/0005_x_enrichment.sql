CREATE TABLE enrichment_jobs(candidate TEXT PRIMARY KEY REFERENCES manual_candidates(id),status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','complete','partial','failed')),attempts INTEGER NOT NULL DEFAULT 0,token TEXT,lease_until INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '',updated_at INTEGER NOT NULL);
CREATE INDEX enrichment_due ON enrichment_jobs(status,next_at);
CREATE TABLE enrichment_results(candidate TEXT PRIMARY KEY REFERENCES manual_candidates(id),proposal TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE enrichment_assets(id TEXT PRIMARY KEY,jpeg BLOB NOT NULL CHECK(length(jpeg)<=307200),created_at INTEGER NOT NULL);
CREATE TABLE enrichment_buttons(token TEXT PRIMARY KEY,proposal_revision INTEGER NOT NULL);
