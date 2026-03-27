-- Create user_subscriptions table for tier management
create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Tier: free, pro_single, pro_plus
  tier text not null default 'free' check (tier in ('free', 'pro_single', 'pro_plus')),
  
  -- Billing cycle (null for free, 'one_time' for pro_single, period for pro_plus)
  billing_cycle text check (billing_cycle in ('one_time', 'monthly', 'quarterly', 'biannual', 'annual', null)),
  
  -- Subscription status
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired', 'past_due')),
  
  -- How many plans this user can create
  plan_limit integer not null default 1,
  
  -- Price paid (stored for reference, in SEK oere/cents)
  price_sek integer default 0,
  
  -- Stripe fields (null until Stripe is integrated)
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  
  -- Dates
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone, -- null = no expiry (free or lifetime)
  cancelled_at timestamp with time zone,
  
  -- Timestamps
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- One active subscription per user
  constraint unique_active_subscription unique (user_id)
);

-- Enable RLS
alter table public.user_subscriptions enable row level security;

-- RLS policies: users can only read their own subscription
create policy "subscriptions_select_own" on public.user_subscriptions 
  for select using (auth.uid() = user_id);

-- Users can insert their own (for initial free tier creation)
create policy "subscriptions_insert_own" on public.user_subscriptions 
  for insert with check (auth.uid() = user_id);

-- Users can update their own subscription
create policy "subscriptions_update_own" on public.user_subscriptions 
  for update using (auth.uid() = user_id);

-- Index for fast lookups
create index if not exists user_subscriptions_user_id_idx on public.user_subscriptions(user_id);
create index if not exists user_subscriptions_tier_idx on public.user_subscriptions(tier);
create index if not exists user_subscriptions_status_idx on public.user_subscriptions(status);

-- Auto-update updated_at
drop trigger if exists update_user_subscriptions_updated_at on public.user_subscriptions;
create trigger update_user_subscriptions_updated_at
  before update on public.user_subscriptions
  for each row
  execute function public.update_updated_at_column();

-- Free tier assignment for new and existing users is handled in app code
-- via the ensureSubscription() function in lib/gomate/tier.ts
-- This runs on every authenticated request and creates a free tier if none exists.
