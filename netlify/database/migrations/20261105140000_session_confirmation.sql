-- Generated from netlify/lib/schema.mjs (migration 7). Netlify applies this on deploy; never edit it once deployed.
ALTER TABLE logs ADD COLUMN confirm text;
UPDATE logs SET confirm = body->'cf'->>'s' WHERE body ? 'cf';
CREATE INDEX ON logs (confirm) WHERE confirm IS NOT NULL;
