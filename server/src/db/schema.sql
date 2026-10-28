-- AI Panel Studio 数据库结构
-- 设计原则：events 为唯一权威事实来源，其余表均为投影

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS discussions (
  id           TEXT PRIMARY KEY,
  topic        TEXT NOT NULL,
  expert_count INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'idle'
               CHECK (status IN ('idle', 'running', 'finished')),
  summary_json TEXT,
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_discussions_created
  ON discussions (created_at DESC);

CREATE TABLE IF NOT EXISTS participants (
  id            TEXT PRIMARY KEY,
  discussion_id TEXT NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('host', 'expert')),
  name          TEXT NOT NULL,
  title         TEXT NOT NULL,
  stance        TEXT NOT NULL,
  color         TEXT NOT NULL,
  seat_index    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_participants_discussion
  ON participants (discussion_id, seat_index);

CREATE TABLE IF NOT EXISTS events (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  discussion_id TEXT NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  payload       TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_discussion_seq
  ON events (discussion_id, seq);

CREATE TABLE IF NOT EXISTS messages (
  id             TEXT PRIMARY KEY,
  discussion_id  TEXT NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  round          INTEGER NOT NULL,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  act            TEXT NOT NULL,
  content        TEXT NOT NULL,
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_discussion
  ON messages (discussion_id, round);

CREATE TABLE IF NOT EXISTS consensus_items (
  id            TEXT PRIMARY KEY,
  discussion_id TEXT NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  round         INTEGER NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('consensus', 'disagreement')),
  content       TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_consensus_discussion
  ON consensus_items (discussion_id, round);

CREATE TABLE IF NOT EXISTS agent_states (
  discussion_id  TEXT NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'waiting'
                 CHECK (status IN ('waiting', 'preparing', 'speaking')),
  focus_memo     TEXT NOT NULL DEFAULT '',
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (discussion_id, participant_id)
);
