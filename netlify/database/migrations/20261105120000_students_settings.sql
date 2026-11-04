-- Generated from netlify/lib/schema.mjs (migration 5). Netlify applies this on deploy; never edit it once deployed.
INSERT INTO students (id, key, name, level, school, info)
SELECT 'st' || substr(encode(sha256(convert_to(lower(regexp_replace(trim(e.key), '\s+', ' ', 'g')), 'UTF8')), 'hex'), 1, 16),
  lower(regexp_replace(trim(e.key), '\s+', ' ', 'g')), coalesce(nullif(e.value->>'name', ''), e.key), e.value->>'level', e.value->>'school',
  jsonb_build_object('hub', e.value, 'hubKey', e.key)
FROM hub_kv k, jsonb_each(k.value) e WHERE k.key = 'kv/lhq_students' AND jsonb_typeof(e.value) = 'object'
ON CONFLICT (key) DO UPDATE SET info = students.info || jsonb_build_object('hub', EXCLUDED.info->'hub', 'hubKey', EXCLUDED.info->'hubKey');
DELETE FROM hub_kv WHERE key = 'kv/lhq_students';

INSERT INTO settings (id, key, scope, value)
SELECT 'hub:' || substr(key, 4), 'hub:' || substr(key, 4), 'staff', value FROM hub_kv
WHERE key IN ('kv/lhq_settings', 'kv/lhq_templates', 'kv/lhq_counters', 'kv/lhq_repEdits', 'kv/lhq_tlinks', 'kv/lhq_budget')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
DELETE FROM hub_kv WHERE key IN ('kv/lhq_settings', 'kv/lhq_templates', 'kv/lhq_counters', 'kv/lhq_repEdits', 'kv/lhq_tlinks', 'kv/lhq_budget');
