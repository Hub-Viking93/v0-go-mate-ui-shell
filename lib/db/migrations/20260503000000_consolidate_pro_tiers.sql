-- Consolidate Pro Single + Pro+ -> single "pro" tier (gomate.md §9.3)
-- Two-tier model: free | pro

alter table public.user_subscriptions
  drop constraint if exists user_subscriptions_tier_check;

update public.user_subscriptions
   set tier = 'pro'
 where tier in ('pro_single', 'pro_plus');

alter table public.user_subscriptions
  add constraint user_subscriptions_tier_check
  check (tier in ('free', 'pro'));

update public.user_subscriptions
   set billing_cycle = 'monthly'
 where billing_cycle in ('one_time', 'quarterly', 'biannual');

reindex index if exists user_subscriptions_tier_idx;
