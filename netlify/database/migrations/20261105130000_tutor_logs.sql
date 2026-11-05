-- Generated from netlify/lib/schema.mjs (migration 6). Netlify applies this on deploy; never edit it once deployed.
CREATE TABLE logs (
  id text PRIMARY KEY,
  rev bigint NOT NULL DEFAULT nextval('lhq_rev'),
  ty text,
  student_key text,
  subject text,
  day date,
  tutor text,
  del boolean NOT NULL DEFAULT false,
  at bigint,
  body jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON logs (student_key, day);
CREATE INDEX ON logs (tutor, day);
CREATE INDEX ON logs (rev);

CREATE TABLE classes (
  id text PRIMARY KEY,
  rev bigint NOT NULL DEFAULT nextval('lhq_rev'),
  tutor text,
  name text,
  del boolean NOT NULL DEFAULT false,
  body jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tutor_reports (
  id text PRIMARY KEY,
  rev bigint NOT NULL DEFAULT nextval('lhq_rev'),
  tutor text,
  day date,
  body jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON tutor_reports (tutor, day);

INSERT INTO logs (id, ty, student_key, subject, day, tutor, del, at, body)
SELECT e.key, e.value->>'ty', nullif(lower(regexp_replace(trim(coalesce(split_part(e.value->>'k', '|', 1), e.value->>'st', '')), '\s+', ' ', 'g')), ''),
  e.value->>'sub', lhq_day(e.value->>'d'), e.value->>'tutor', coalesce(e.value ? 'x', false), (lhq_num(e.value->>'at'))::bigint, e.value
FROM hub_kv k, jsonb_each(k.value->'e') e WHERE k.key = 'kv/lhq_logs' AND jsonb_typeof(e.value) = 'object'
ON CONFLICT (id) DO NOTHING;
INSERT INTO tutor_reports (id, tutor, day, body)
SELECT e.key, e.value->>'tutor', lhq_day(e.value->>'d'), e.value
FROM hub_kv k, jsonb_each(k.value->'e') e WHERE k.key = 'kv/lhq_treps' AND jsonb_typeof(e.value) = 'object'
ON CONFLICT (id) DO NOTHING;
INSERT INTO classes (id, tutor, name, del, body)
SELECT e.key, e.value->>'tutor', e.value->>'name', coalesce((e.value->>'del')::boolean, false), e.value
FROM hub_kv k, jsonb_each(k.value) e WHERE k.key = 'kv/lhq_classes' AND jsonb_typeof(e.value) = 'object'
ON CONFLICT (id) DO NOTHING;
INSERT INTO settings (id, key, scope, value)
SELECT 'hub:' || substr(key, 4) || ':rest', 'hub:' || substr(key, 4) || ':rest', 'staff', value - 'e' FROM hub_kv WHERE key IN ('kv/lhq_logs', 'kv/lhq_treps')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
DELETE FROM hub_kv WHERE key IN ('kv/lhq_logs', 'kv/lhq_treps', 'kv/lhq_classes');
