-- Server-only email transport configuration stored in Supabase
-- Strictly inaccessible to anon/authenticated roles; only service_role may read/write.
CREATE TABLE IF NOT EXISTS private_mailer_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'smtp' CHECK (provider IN ('smtp', 'resend')),
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 465,
  smtp_secure BOOLEAN DEFAULT TRUE,
  smtp_user TEXT,
  smtp_pass TEXT,
  from_address TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE private_mailer_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private_mailer_config FROM PUBLIC;
REVOKE ALL ON TABLE private_mailer_config FROM anon;
REVOKE ALL ON TABLE private_mailer_config FROM authenticated;
GRANT ALL ON TABLE private_mailer_config TO service_role;
