-- Down: restore three-tier CHECK (data not reverted; pro stays pro).
alter table public.user_subscriptions
  drop constraint if exists user_subscriptions_tier_check;

alter table public.user_subscriptions
  add constraint user_subscriptions_tier_check
  check (tier in ('free', 'pro_single', 'pro_plus', 'pro'));
