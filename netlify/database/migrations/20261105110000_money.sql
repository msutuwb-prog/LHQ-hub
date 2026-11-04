-- Generated from netlify/lib/schema.mjs (migration 4). Netlify applies this on deploy; never edit it once deployed.
CREATE TABLE money (
  id text PRIMARY KEY,
  rev bigint NOT NULL DEFAULT nextval('lhq_rev'),
  kind text NOT NULL CHECK (kind IN ('spend','income')),
  entry_date date,
  cat text,
  amount numeric,
  del boolean NOT NULL DEFAULT false,
  added_by text,
  body jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON money (kind, entry_date);
CREATE INDEX ON money (rev);

INSERT INTO money (id, kind, entry_date, cat, amount, del, added_by, body)
SELECT e.key, CASE WHEN k.key = 'kv/lhq_spend' THEN 'spend' ELSE 'income' END, lhq_day(e.value->>'date'), e.value->>'cat',
  lhq_num(e.value->>'amount'), coalesce((e.value->>'del')::boolean, false), e.value->>'by', e.value
FROM hub_kv k, jsonb_each(k.value) e WHERE k.key IN ('kv/lhq_spend', 'kv/lhq_income') AND jsonb_typeof(e.value) = 'object'
ON CONFLICT (id) DO NOTHING;
DELETE FROM hub_kv WHERE key IN ('kv/lhq_spend', 'kv/lhq_income');
