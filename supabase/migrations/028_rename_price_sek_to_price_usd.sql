-- Migration 028: Rename price_sek to price_usd
-- Pricing model changed from SEK to USD. Rename column to match TypeScript interface.

ALTER TABLE user_subscriptions RENAME COLUMN price_sek TO price_usd;
