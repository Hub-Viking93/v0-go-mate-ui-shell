-- Migration 025: Usage tracking for cost guardrails
-- Tracks generation events per user for server-side limit enforcement.

CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('research', 'guide_generation', 'settling_in_generation', 'chat_message')),
  plan_id uuid REFERENCES public.relocation_plans(id) ON DELETE SET NULL,
  token_estimate integer, -- estimated tokens consumed (nullable, best-effort)
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for fast per-user lookups within a time window
CREATE INDEX IF NOT EXISTS usage_events_user_type_created
  ON public.usage_events (user_id, event_type, created_at DESC);

-- Index for rate limiting (recent events per user)
CREATE INDEX IF NOT EXISTS usage_events_user_recent
  ON public.usage_events (user_id, created_at DESC);

-- RLS: users can only see their own usage
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_usage" ON public.usage_events
  FOR ALL USING (auth.uid() = user_id);

-- Auto-cleanup: delete events older than 90 days (run manually or via cron)
-- This keeps the table small. Monthly limit checks only need 31 days of data.
COMMENT ON TABLE public.usage_events IS 'Tracks API usage per user for rate limiting and generation caps. Safe to prune rows older than 90 days.';
