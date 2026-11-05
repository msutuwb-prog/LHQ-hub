-- Generated from netlify/lib/schema.mjs (migration 2). Netlify applies this on deploy; never edit it once deployed.
CREATE TABLE hub_kv (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  etag text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hub_kv_prefix ON hub_kv (key text_pattern_ops);
