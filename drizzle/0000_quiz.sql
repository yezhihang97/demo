CREATE TABLE service_keys (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE passes (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  order_ref TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  session_hash TEXT,
  revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (slug, order_ref)
);
--> statement-breakpoint
CREATE UNIQUE INDEX passes_session ON passes(session_hash) WHERE session_hash IS NOT NULL;
--> statement-breakpoint
CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  pass_id TEXT NOT NULL REFERENCES passes(id),
  answers TEXT NOT NULL DEFAULT '{}',
  revision INTEGER NOT NULL DEFAULT 0,
  result TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX one_open_attempt ON attempts(pass_id) WHERE finished_at IS NULL;
--> statement-breakpoint
CREATE INDEX pass_results ON attempts(pass_id, finished_at DESC);
--> statement-breakpoint
CREATE TABLE rate_limits (
  bucket TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX rate_expiry ON rate_limits(expires);
