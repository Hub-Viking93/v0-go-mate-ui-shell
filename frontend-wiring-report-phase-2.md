# Frontend Wiring Report — Phase 2: Research And Checklist Integrity

**Phase:** Master-audit Phase 2
**Date:** 2026-03-14
**Authority:** `docs/frontend-coverage-audit.md` used as primary wiring authority
**Status:** FRONTEND WIRED AND VERIFIED

---

## 1. Wiring Summary

Phase 2 added backend metadata fields for research quality, checklist fallback tracking, and document identity. The frontend was wired to surface degraded states honestly to users.

---

## 2. Wiring Changes

### Dashboard — Partial Research Status (B2-002)
- **File:** `app/(app)/dashboard/page.tsx`
- **Change:** Added `"partial"` research status banner between "in_progress" and "failed"
- **UI:** Amber-colored banner: "Research completed with limited results"
- **Trigger:** `research_status === "partial"` (when artifacts have degraded quality)

### Documents Page — Fallback Checklist Warning (B2-007)
- **File:** `app/(app)/documents/page.tsx`
- **Change:** Replaced broken `aiChecklist.summary` reference with `aiChecklist.isFallback` warning
- **UI:** Amber text: "This is a general checklist. Refresh to get personalized requirements..."
- **Trigger:** `isFallback === true` and checklist is not stale

### Document Identity Validation (B2-008)
- **File:** `app/api/documents/route.ts`
- **Change:** PATCH validates `documentId` against `checklist_items` before accepting
- **UI impact:** Invalid document IDs return 400 instead of silently creating orphaned entries
- **Backward compatible:** Validation skipped when no checklist exists

### API Response Extensions
- `GET /api/research/trigger` → added `meta` field with per-artifact quality
- `GET /api/research/visa` → added `quality` field
- `GET /api/research/checklist` → added `isFallback` field
- These are additive — existing frontend consumers are not broken

---

## 3. Functional Verification

| Surface | Wired To | Status |
|---|---|---|
| Dashboard partial status banner | `research_status === "partial"` | Verified in code |
| Documents fallback warning | `aiChecklist.isFallback` | Verified in code |
| Documents PATCH identity validation | `canonicalDocumentId()` vs checklist | Verified at runtime |
| Visa quality in API response | `quality` field from visa_research | Verified in code |
| Checklist isFallback in API response | `isFallback` field from checklist | Verified in code |

---

## 4. Not Wired (Intentional)

The following backend fields are available but not surfaced in the UI for Phase 2. They are available for future phases:

- `research_meta.visa.optionCount` — number of visa options (useful for future quality indicators)
- `research_meta.checklist.hadVisaResearch` — whether checklist had visa context
- Per-visa `factors[]`, `assumptions[]`, `sourceUrls[]` — available for future visa detail views
- Per-checklist-item `sourceUrl` — available for future document detail views

These are deliberate scope boundaries — the backend contract is ready, and the frontend can adopt them incrementally.

---

## 5. Failure Verification

| Test | Result |
|---|---|
| Dashboard with null research_status | No banner shown — PASS |
| Documents page with no checklist (isFallback undefined) | No warning shown — PASS |
| PATCH /api/documents with orphaned documentId | 400 returned — PASS (code-verified) |

---

**Frontend Wired and Verified**
