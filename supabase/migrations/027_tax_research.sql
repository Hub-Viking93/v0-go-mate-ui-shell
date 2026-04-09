-- Migration 026: Tax research JSONB column on relocation_plans
-- Stores AI-extracted tax data from Firecrawl scraping of tax authority websites

ALTER TABLE relocation_plans
  ADD COLUMN IF NOT EXISTS tax_research jsonb DEFAULT NULL;
