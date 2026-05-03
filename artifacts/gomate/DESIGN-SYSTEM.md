# GoMate v2 — Design System Notes

This file is a small living index of UI primitives that MUST be reused
rather than re-implemented per page. When you build a new feature that
displays one of these concepts, extend the existing primitive instead
of writing a one-off variant. Add the new primitive here when you
introduce one.

## Profile fields

**Source of truth:** `src/components/profile-field-chip.tsx` and
`src/components/profile-preview-list.tsx`.

| Surface                                | Component                         | Variant    |
| -------------------------------------- | --------------------------------- | ---------- |
| `/onboarding` right side panel         | `ProfilePreviewList`              | `compact`  |
| `/dashboard` Profile Details Card †    | `ProfileFieldChip`                | `full`     |
| Anywhere else a single field is shown  | `ProfileFieldChip`                | either     |

† **Phase 4.1 TODO** — when the `/dashboard` Profile Details Card is
built, it MUST consume `ProfileFieldChip` in `full` variant. Do not
copy/paste the rendering logic. If new field types (rich objects,
nested arrays) need a different layout, extend `ProfileFieldChip` with
a new variant — keep the audit-dot, label, value-formatter, and color
tokens shared.

### Why the same primitive on both surfaces?

The user sees their fields in the onboarding side panel and again on
the dashboard. If the two surfaces drift visually, the dashboard feels
like a different app. By forcing both surfaces through one primitive
we guarantee:

- Same field label (drawn from `FIELD_CONFIG[key].label`)
- Same audit-dot color semantics (explicit / inferred / assumed)
- Same value formatter (booleans → Yes/No, arrays → comma-joined, etc.)
- Same hover state and color tokens (light/dark mode flip together)

### Audit-dot color semantics

| Confidence  | Dot color (light mode) | Meaning                                |
| ----------- | ---------------------- | -------------------------------------- |
| `explicit`  | primary green          | User said the value directly           |
| `inferred`  | muted slate            | Extractor inferred from context        |
| `assumed`   | amber                  | Extractor guessed; user should verify  |
| _(absent)_  | neutral ring           | No confidence info attached yet        |

There is currently no design-system token for "warning amber" — chips
fall back to `bg-amber-500`. If/when a `--warning` token lands in
`src/index.css`, swap the hard-coded amber in `confidenceDotClasses`
for the token.

## Visual QA route

`/dev/profile-field-chip` renders both variants side by side, plus the
full `ProfilePreviewList` container in empty and populated states.
Open it whenever you change either component to spot regressions.
