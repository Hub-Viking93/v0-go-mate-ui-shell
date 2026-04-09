-- Migration 025: Update v1 additions
-- Phase A: Data foundation — new JSONB columns on relocation_plans + chat_messages table

-- 1. Add new JSONB columns to relocation_plans (used by later phases)
ALTER TABLE relocation_plans
  ADD COLUMN IF NOT EXISTS visa_application jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS wellbeing_checkins jsonb DEFAULT '[]';

-- 2. Chat history table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES relocation_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_plan_created
  ON chat_messages (plan_id, created_at ASC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS: users can only access their own messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'users_own_chat_messages'
  ) THEN
    CREATE POLICY "users_own_chat_messages" ON chat_messages
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END
$$;
