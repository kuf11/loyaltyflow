CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]{2,50}$'),
  name text NOT NULL DEFAULT 'Моя программа',
  bot_username text,
  app_url text,
  sync_secret_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mini_app_configs (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  design jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS businesses_slug_idx ON businesses(slug);
REVOKE ALL ON businesses, mini_app_configs FROM PUBLIC;
