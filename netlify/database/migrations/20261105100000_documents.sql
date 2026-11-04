-- Generated from netlify/lib/schema.mjs (migration 3). Netlify applies this on deploy; never edit it once deployed.
CREATE FUNCTION lhq_num(t text) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN t ~ '^-?[0-9]+(\.[0-9]+)?$' THEN t::numeric END $$;
CREATE FUNCTION lhq_day(t text) RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN t ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN t::date END $$;

CREATE TABLE documents (
  id text PRIMARY KEY,
  rev bigint NOT NULL DEFAULT nextval('lhq_rev'),
  type text NOT NULL,
  number text,
  student text,
  student_key text,
  doc_date date,
  due_date date,
  period_start date, period_end date,
  total numeric,
  received numeric,
  paid numeric,
  ref text,
  saved_at bigint,
  saved_by text,
  body jsonb NOT NULL,
  etag text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON documents (type, number);
CREATE INDEX ON documents (student_key);
CREATE INDEX ON documents (type, doc_date);
CREATE INDEX ON documents (rev);

CREATE TABLE doc_history (
  id text PRIMARY KEY,
  doc_id text NOT NULL,
  at bigint NOT NULL,
  body jsonb NOT NULL,
  etag text NOT NULL
);
CREATE INDEX ON doc_history (doc_id, at);

CREATE TABLE doc_trash (
  id text PRIMARY KEY,
  body jsonb NOT NULL,
  deleted_at bigint,
  deleted_by text,
  etag text NOT NULL
);

INSERT INTO documents (id, type, number, student, student_key, doc_date, due_date, period_start, period_end, total, received, paid, ref, saved_at, saved_by, body, etag)
SELECT substr(key, 5), coalesce(value->>'type', 'quote'), value->>'number', value->>'student',
  lower(regexp_replace(trim(coalesce(value->>'student', value->>'name', '')), '\s+', ' ', 'g')),
  lhq_day(value->>'date'), lhq_day(value->>'dueDate'), lhq_day(value->>'periodStart'), lhq_day(value->>'periodEnd'),
  lhq_num(value->>'total'), lhq_num(value->>'receivedAmt'), lhq_num(value->>'paid'), value->>'ref',
  (lhq_num(value->>'savedAt'))::bigint, value->>'updatedBy', value, etag
FROM hub_kv WHERE key LIKE 'doc/%';
INSERT INTO doc_history (id, doc_id, at, body, etag)
SELECT substr(key, 6), split_part(substr(key, 6), '/', 1), coalesce((lhq_num(split_part(substr(key, 6), '/', 2)))::bigint, 0), value, etag
FROM hub_kv WHERE key LIKE 'hist/%';
INSERT INTO doc_trash (id, body, deleted_at, deleted_by, etag)
SELECT substr(key, 7), value, (lhq_num(value->>'deletedAt'))::bigint, value->>'deletedBy', etag FROM hub_kv WHERE key LIKE 'trash/%';
DELETE FROM hub_kv WHERE key LIKE 'doc/%' OR key LIKE 'hist/%' OR key LIKE 'trash/%';
