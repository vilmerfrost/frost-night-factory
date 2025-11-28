CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  dark_mode BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences (user_id);

-- Consider RLS if multi-tenant. Example policy below.
-- CREATE POLICY user_preferences_policy ON user_preferences
-- FOR ALL
-- USING (auth.uid() = user_id)
-- WITH CHECK (auth.uid() = user_id);
-- ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_preferences FORCE ROW LEVEL SECURITY;