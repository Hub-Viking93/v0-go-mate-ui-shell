# Bug Log — Phase 2: Research And Checklist Integrity

**Phase:** Master-audit Phase 2 (B2-002, B2-004, B2-005, B2-007, B2-008, B2-010, B2-011, B2-012)
**Date:** 2026-03-14

## Bugs Discovered During Runtime Testing

### BUG-PHASE2-001 — FIXED
- **Severity:** High
- **Status:** Fixed (migration 022)
- **Area:** Database check constraint `relocation_plans_research_status_check`
- **Summary:** The `research_status` column has a check constraint allowing only `pending`, `in_progress`, `completed`, `failed`. Phase 2 introduced the `partial` status value (B2-002) but did not update the constraint. The trigger route computed `partial` correctly and returned it in the response, but the final DB update silently failed with error code 23514.
- **Root cause:** The constraint was applied to the DB outside the migration files (not in scripts/016). Phase 2 migration 021 only added `research_meta`, not the constraint update.
- **Fix:** Migration 022 (`supabase/scripts/022_add_partial_research_status.sql`) drops and recreates the constraint with `partial` included. Applied and verified.

## Pre-Existing Issues (Not Caused by Phase 2)

### PHASE2-PREEXIST-001
- Severity: Medium
- Status: Open (pre-existing)
- Area: `lib/gomate/checklist-generator.ts` lines 121, 156
- Summary: Firecrawl SDK type mismatches (`success`, `data` on SearchData, `scrapeUrl` should be `scrape`)
- Impact: Does not affect runtime (JS is untyped at runtime), but fails TypeScript strict check

### PHASE2-PREEXIST-002
- Severity: Low
- Status: Open (pre-existing)
- Area: `app/(app)/documents/page.tsx` line 573
- Summary: References `aiChecklist.summary` which does not exist on `GeneratedChecklist` type
- Impact: Runtime null-check prevents crash, but property is never displayed

## Runtime Verification Summary (2026-03-14)

Verified against localhost:3000 with authenticated test user:

- `research_meta` column accessible via Supabase REST → PASS
- `visa_research.visaOptions` present with 2 options → PASS
- `checklist_items` present with 7 items, all canonical IDs → PASS
- `document_statuses` PATCH with `documentName` tracking → PASS
- `canonicalDocumentId()` normalization: all 4 test cases → PASS
- No new TypeScript errors introduced by Phase 2 changes → PASS

Pre-existing data shows "NOT SET" for new fields (quality, isFallback, etc.), which is expected — populated on next research trigger.
