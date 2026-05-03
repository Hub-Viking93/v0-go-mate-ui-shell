// =============================================================
// Wave 2.3 — Collecting-stage orchestration
// =============================================================
// Single-turn pipeline run for the `collecting` chat stage:
//
//   user message
//     ↓
//   getNextPendingField(profile) → fieldKey
//     ↓
//   extractor.extractField        → value | null
//     ↓ (if value !== null)
//   validator.validate            → normalized | retryHint
//     ↓ (if valid)
//   profile-writer.writeProfileField (atomic JSONB merge + audit)
//     ↓
//   askNext (Question Director)   → next question + animationCue
//                                   OR isOnboardingComplete=true
//
// Audit / run-log writes flow through the LogWriter dependency
// (Supabase in production; in-memory in tests).
//
// Returns a fully-formed result the route handler streams to the
// client. No HTTP work happens here — the orchestrator is pure
// logic so it can be exercised by a node script with stub stores.
// =============================================================

import {
  extractField,
  validate,
  writeProfileField,
  askNext,
  type AnimationCue,
  type AllFieldKey,
  type LogWriter,
  type ProfileStore,
  type QuestionDirectorMessage,
} from "@workspace/agents";

import {
  getRequiredFields,
  getNextPendingField,
  type AllFieldKey as SnapshotFieldKey,
  type Profile as SnapshotProfile,
} from "./profile-schema-snapshot";

export type MascotEventKind =
  | "thinking_start"
  | "extraction_complete"
  | "validation_complete"
  | "profile_updated"
  | "question_ready"
  | "onboarding_complete";

export interface MascotEvent {
  kind: MascotEventKind;
  /** Only set on `question_ready`. */
  animationCue?: AnimationCue;
  /** Set on extraction_complete / profile_updated / question_ready. */
  field?: AllFieldKey;
  /** Set on extraction_complete (extractor's confidence). */
  confidence?: string;
  /** Set on validation_complete (normalized value, or retry hint string). */
  detail?: string;
}

export interface OrchestrateCollectingArgs {
  profileId: string;
  profile: SnapshotProfile;
  /** Already-known fieldKey from the client (e.g. the last pending field). Optional — we recompute when missing. */
  hintedPendingField?: AllFieldKey | null;
  /** Last user message text. */
  userMessage: string;
  /** Conversation tail (capped by askNext). */
  conversationHistory: QuestionDirectorMessage[];
  /** Optional last assistant message — extra context for the Extractor. */
  lastAssistantMessage?: string | null;
  /** Production: Supabase-backed. Tests: in-memory. */
  store: ProfileStore;
  /** Production: Supabase-backed. Tests: in-memory. */
  writer: LogWriter;
}

export interface OrchestrateCollectingResult {
  /** True when getRequiredFields() returned [] for the latest profile. */
  isOnboardingComplete: boolean;
  /** The field we just attempted to extract for (may be null on a brand-new empty profile with no fields needed). */
  attemptedField: AllFieldKey | null;
  /** True when extractor produced a non-null value AND validator accepted it. */
  fieldFilled: boolean;
  /** Profile after the optional write (same object that was persisted). */
  profileAfter: SnapshotProfile;
  /** Filled-field keys after the optional write. */
  filledFields: AllFieldKey[];
  /** Required-field keys for the new profile. */
  requiredFields: AllFieldKey[];
  /** Next pending field for the new profile (null when complete). */
  nextPendingField: AllFieldKey | null;
  /** The question to surface to the user (or a celebratory note when complete). */
  questionText: string;
  /** Mascot animation cue for the question. */
  animationCue: AnimationCue;
  /** Ordered mascot events the route should stream BEFORE the question text. */
  mascotEvents: MascotEvent[];
  /** Validator error retryHint when validation failed (so the QD can re-ask). */
  retryHint?: string;
  /**
   * Other field keys the Extractor noticed the user volunteered in this
   * turn (besides the pending one we just attempted). Forwarded to the
   * Question Director for next-turn prioritisation, and exposed here so
   * route handlers / test harnesses / debug UIs can observe it.
   */
  extractorAdditionalFieldsDetected: AllFieldKey[];
}

/**
 * Run the collecting-stage agent chain for one user turn.
 *
 * Note: the route handler is responsible for SSE framing + writing
 * back to the client. This helper returns a serializable result so
 * the same code path can be unit-tested with in-memory stores.
 */
export async function orchestrateCollecting(
  args: OrchestrateCollectingArgs,
): Promise<OrchestrateCollectingResult> {
  const mascotEvents: MascotEvent[] = [];
  mascotEvents.push({ kind: "thinking_start" });

  // 1. Determine the field we're trying to fill.
  //
  // BUG FIX (citizenship loop): we MUST pick the same field the Question
  // Director will ask about, otherwise the extractor tries to pull field A
  // from a user message that's actually answering field B and returns null
  // forever. QD walks `getRequiredFields(profile)` (FIELD_RULES insertion
  // order), filters out already-filled and `_skipped_fields`, and picks the
  // first remaining. Mirror that here instead of using `getNextPendingField`
  // (which walks the divergent FIELD_ORDER array).
  function computeAttemptedField(): SnapshotFieldKey | null {
    const required = getRequiredFields(args.profile) as SnapshotFieldKey[];
    const skippedRaw = (args.profile as Record<string, unknown>)["_skipped_fields"];
    const skipped = new Set<string>(
      Array.isArray(skippedRaw)
        ? skippedRaw.filter((k): k is string => typeof k === "string")
        : [],
    );
    for (const k of required) {
      if (skipped.has(k)) continue;
      const v = (args.profile as Record<string, unknown>)[k];
      if (v === null || v === undefined) return k;
      if (typeof v === "string" && v.trim().length === 0) return k;
    }
    return null;
  }
  // Only honor the client's hint if it still agrees with what we'd compute
  // ourselves — i.e. the hinted field is still required, unfilled, and not
  // skipped. A stale hint from an out-of-date client could otherwise
  // reintroduce the same A-vs-B mismatch the bug fix above resolves.
  const computed = computeAttemptedField();
  const hint = args.hintedPendingField as SnapshotFieldKey | null | undefined;
  const required = getRequiredFields(args.profile) as SnapshotFieldKey[];
  const skippedRaw = (args.profile as Record<string, unknown>)["_skipped_fields"];
  const skippedSet = new Set<string>(
    Array.isArray(skippedRaw)
      ? skippedRaw.filter((k): k is string => typeof k === "string")
      : [],
  );
  const hintIsValid =
    !!hint &&
    required.includes(hint) &&
    !skippedSet.has(hint) &&
    (() => {
      const v = (args.profile as Record<string, unknown>)[hint];
      if (v === null || v === undefined) return true;
      if (typeof v === "string" && v.trim().length === 0) return true;
      return false;
    })();
  const attemptedField = hintIsValid ? hint : computed;

  // Brand-new profile with no required fields at all (impossible in
  // practice — `name` is always required — but defensive).
  if (!attemptedField) {
    return finaliseAlreadyComplete(args.profile, mascotEvents);
  }

  // 2a. Phase 4 bug fix #2B — deflection detection.
  // If the user is short-circuiting the question ("skip", "later",
  // "not sure"), don't waste an LLM call on extraction. Mark the
  // attempted field as user-skipped so the Question Director picks a
  // different field next turn (and forever). Real users have agency to
  // skip; the system shouldn't keep asking the same skipped field.
  const trimmedMsg = args.userMessage.trim();
  const isShort = trimmedMsg.length > 0 && trimmedMsg.length < 25;
  const deflectionRe = /\b(skip|not sure|later|don'?t know|dunno|pass|no idea|prefer not|maybe later|not now|no comment)\b/i;
  const isDeflection = isShort && deflectionRe.test(trimmedMsg);

  if (isDeflection) {
    // Persist the skipped field directly via the store. We bypass
    // profile-writer because _skipped_fields is a meta key, not part
    // of the closed schema profile-writer guards.
    const prevSkippedRaw = (args.profile as Record<string, unknown>)["_skipped_fields"];
    const prevSkipped = Array.isArray(prevSkippedRaw)
      ? prevSkippedRaw.filter((k): k is string => typeof k === "string")
      : [];
    const nextSkipped = Array.from(new Set([...prevSkipped, attemptedField]));
    let mergedAfterSkip: Record<string, unknown> | undefined;
    try {
      mergedAfterSkip = await args.store.applyFieldPatch(args.profileId, {
        _skipped_fields: nextSkipped,
      });
    } catch {
      // Best-effort — if persistence fails the next turn will simply
      // ask the same field again. Don't break the response.
    }
    const profileAfterSkip: SnapshotProfile =
      (mergedAfterSkip as SnapshotProfile | undefined) ?? {
        ...args.profile,
        _skipped_fields: nextSkipped,
      } as SnapshotProfile;

    mascotEvents.push({
      kind: "extraction_complete",
      field: attemptedField,
      confidence: "fallback",
    });
    mascotEvents.push({
      kind: "validation_complete",
      field: attemptedField,
      detail: "user_deflected",
    });

    // Ask the Question Director for the NEXT field (skipped is now
    // filtered out of stillNeeded inside askNext).
    const askResultSkip = await askNext(
      profileAfterSkip,
      args.conversationHistory,
      [],
      {
        getRequiredFields: (p) => getRequiredFields(p as SnapshotProfile) as AllFieldKey[],
        writer: args.writer,
        profileId: args.profileId,
      },
    );
    const filledFieldsSkip = computeFilledFields(profileAfterSkip);
    const requiredFieldsSkip = getRequiredFields(profileAfterSkip) as AllFieldKey[];
    if (askResultSkip.isOnboardingComplete) {
      mascotEvents.push({ kind: "onboarding_complete" });
      return {
        isOnboardingComplete: true,
        attemptedField,
        fieldFilled: false,
        profileAfter: profileAfterSkip,
        filledFields: filledFieldsSkip,
        requiredFields: requiredFieldsSkip,
        nextPendingField: null,
        questionText:
          "No worries — your profile is solid enough to start. " +
          "Click \"Generate my plan\" whenever you're ready, and you can refine details later from the dashboard.",
        animationCue: "celebrating",
        mascotEvents,
        extractorAdditionalFieldsDetected: [],
      };
    }
    const nextPendingFieldSkip =
      (askResultSkip.nextFieldKey as AllFieldKey | undefined) ?? null;
    const questionTextSkip =
      askResultSkip.questionText ?? "What would you like to share next?";
    const animationCueSkip: AnimationCue =
      askResultSkip.animationCue ?? "tilting_curious";
    mascotEvents.push({
      kind: "question_ready",
      field: nextPendingFieldSkip ?? undefined,
      animationCue: animationCueSkip,
    });
    return {
      isOnboardingComplete: false,
      attemptedField,
      fieldFilled: false,
      profileAfter: profileAfterSkip,
      filledFields: filledFieldsSkip,
      requiredFields: requiredFieldsSkip,
      nextPendingField: nextPendingFieldSkip,
      questionText: questionTextSkip,
      animationCue: animationCueSkip,
      mascotEvents,
      extractorAdditionalFieldsDetected: [],
    };
  }

  // 2. Extractor.
  const extraction = await extractField(
    args.userMessage,
    attemptedField,
    args.lastAssistantMessage ?? undefined,
    { writer: args.writer, profileId: args.profileId },
  );
  mascotEvents.push({
    kind: "extraction_complete",
    field: attemptedField,
    confidence: extraction.confidence,
  });

  let fieldFilled = false;
  let profileAfter: SnapshotProfile = args.profile;
  let retryHint: string | undefined;

  if (extraction.value === null) {
    // Extractor said "I couldn't tell". Skip validator/writer; QD will re-ask.
    retryHint = extraction.uncertaintyReason ?? "value_not_present";
    mascotEvents.push({
      kind: "validation_complete",
      field: attemptedField,
      detail: retryHint,
    });
  } else {
    // 3. Validator.
    const validation = validate(extraction.value, attemptedField);
    if (!validation.valid) {
      retryHint = validation.retryHint;
      mascotEvents.push({
        kind: "validation_complete",
        field: attemptedField,
        detail: validation.retryHint,
      });
    } else {
      mascotEvents.push({
        kind: "validation_complete",
        field: attemptedField,
        detail: String(validation.normalizedValue),
      });
      // 4. Profile writer (atomic merge + audit).
      const write = await writeProfileField(
        args.profileId,
        attemptedField,
        validation.normalizedValue,
        extraction.confidence,
        args.userMessage,
        validation.rulesApplied,
        { store: args.store, writer: args.writer },
      );

      // 4b. READ-AFTER-WRITE VERIFICATION GATE.
      // Re-read profile_data from the source-of-truth and confirm the
      // attempted field is actually present. The Question Director is
      // NOT allowed to advance to the next field until DB confirms the
      // write landed. If verification fails we degrade gracefully:
      //  - mark fieldFilled=false
      //  - emit a retryHint
      //  - QD will re-ask the same field next turn (it's still in
      //    stillNeeded because the fresh read shows it unfilled)
      // This catches RPC silent-failures, race conditions with the
      // skip-fields meta merge, and any future bug where the merged
      // row returned by applyFieldPatch diverges from what's persisted.
      let verifiedProfile: SnapshotProfile | null = null;
      try {
        const fresh = await args.store.getProfileData(args.profileId);
        if (fresh && typeof fresh === "object") {
          verifiedProfile = fresh as SnapshotProfile;
        }
      } catch {
        // store.read failure is non-fatal here — we'll fall back to
        // write.profileData below and log the gap via retryHint.
      }

      const verifiedValue =
        verifiedProfile != null
          ? (verifiedProfile as Record<string, unknown>)[attemptedField]
          : undefined;
      const verifiedNonEmpty =
        verifiedValue !== null &&
        verifiedValue !== undefined &&
        !(typeof verifiedValue === "string" && verifiedValue.trim().length === 0);

      if (verifiedNonEmpty && verifiedProfile) {
        fieldFilled = true;
        profileAfter = verifiedProfile;
        mascotEvents.push({
          kind: "profile_updated",
          field: attemptedField,
        });
      } else {
        // Verification failed — write claims success but DB doesn't
        // reflect the field. Do NOT advance; let QD re-ask.
        fieldFilled = false;
        retryHint = "verification_read_after_write_failed";
        mascotEvents.push({
          kind: "validation_complete",
          field: attemptedField,
          detail: retryHint,
        });
        // Use the merged row the writer returned so the response is
        // still well-formed (filledFields list will not include the
        // unverified field because verifiedProfile was empty there).
        if (write.profileData) {
          profileAfter = write.profileData as SnapshotProfile;
        } else {
          profileAfter = args.profile;
        }
      }
    }
  }

  // 4c. FAN-OUT EXTRACTION.
  // The Extractor returns `additionalFieldsDetected` for any other field
  // keys the user volunteered in the same message. Without fan-out, those
  // values are LOST — the user has to re-state everything one field at a
  // time. We re-run the Extractor against the SAME user message for each
  // detected field, validate, write, and re-verify against the DB.
  //
  // Cap the burst at MAX_FANOUT_PER_TURN to bound LLM cost / latency.
  // Skip a detected field if (a) it's not currently required, (b) it's
  // already been filled in profileAfter, or (c) it's been user-skipped.
  const MAX_FANOUT_PER_TURN = 8;
  const fanoutFilledFields: AllFieldKey[] = [];
  const fanoutAttemptedFields: AllFieldKey[] = [];
  if (extraction.additionalFieldsDetected.length > 0) {
    const requiredAfter = new Set<string>(
      getRequiredFields(profileAfter) as SnapshotFieldKey[],
    );
    const skippedAfterRaw = (profileAfter as Record<string, unknown>)["_skipped_fields"];
    const skippedAfter = new Set<string>(
      Array.isArray(skippedAfterRaw)
        ? skippedAfterRaw.filter((k): k is string => typeof k === "string")
        : [],
    );
    let budget = MAX_FANOUT_PER_TURN;
    for (const detectedKey of extraction.additionalFieldsDetected) {
      if (budget <= 0) break;
      if (detectedKey === attemptedField) continue;
      if (!requiredAfter.has(detectedKey)) continue;
      if (skippedAfter.has(detectedKey)) continue;
      const existing = (profileAfter as Record<string, unknown>)[detectedKey];
      const alreadyFilled =
        existing !== null &&
        existing !== undefined &&
        !(typeof existing === "string" && existing.trim().length === 0);
      if (alreadyFilled) continue;

      budget -= 1;
      fanoutAttemptedFields.push(detectedKey);
      const fanExtraction = await extractField(
        args.userMessage,
        detectedKey,
        args.lastAssistantMessage ?? undefined,
        { writer: args.writer, profileId: args.profileId },
      );
      if (fanExtraction.value === null) continue;
      const fanValidation = validate(fanExtraction.value, detectedKey);
      if (!fanValidation.valid) continue;

      try {
        await writeProfileField(
          args.profileId,
          detectedKey,
          fanValidation.normalizedValue,
          fanExtraction.confidence,
          args.userMessage,
          fanValidation.rulesApplied,
          { store: args.store, writer: args.writer },
        );
      } catch {
        continue;
      }

      // Read-after-write verification for the fan-out write too.
      let fanVerified: SnapshotProfile | null = null;
      try {
        const fresh = await args.store.getProfileData(args.profileId);
        if (fresh && typeof fresh === "object") {
          fanVerified = fresh as SnapshotProfile;
        }
      } catch { /* non-fatal */ }
      const fanVerifiedValue =
        fanVerified != null
          ? (fanVerified as Record<string, unknown>)[detectedKey]
          : undefined;
      const fanOk =
        fanVerifiedValue !== null &&
        fanVerifiedValue !== undefined &&
        !(typeof fanVerifiedValue === "string" && fanVerifiedValue.trim().length === 0);
      if (fanOk && fanVerified) {
        profileAfter = fanVerified;
        fanoutFilledFields.push(detectedKey);
        mascotEvents.push({
          kind: "profile_updated",
          field: detectedKey,
        });
      }
    }
  }

  // 4d. AUTO-SKIP after repeated extraction failures on the same field.
  // Track per-field attempt counts in profile_data._field_attempts. When
  // we've asked the same field MAX_FIELD_ATTEMPTS times without
  // extracting a value, mark it user-skipped so QD moves on. This stops
  // the "asks citizenship 6 times in a row" loop seen in the smoke test
  // when the user keeps providing related-but-not-matching info.
  if (!fieldFilled && attemptedField) {
    const MAX_FIELD_ATTEMPTS = 3;
    const attemptsRaw = (profileAfter as Record<string, unknown>)["_field_attempts"];
    const attempts =
      attemptsRaw && typeof attemptsRaw === "object" && !Array.isArray(attemptsRaw)
        ? { ...(attemptsRaw as Record<string, number>) }
        : {};
    const prev = typeof attempts[attemptedField] === "number" ? attempts[attemptedField] : 0;
    attempts[attemptedField] = prev + 1;

    if (attempts[attemptedField] >= MAX_FIELD_ATTEMPTS) {
      const prevSkippedRaw = (profileAfter as Record<string, unknown>)["_skipped_fields"];
      const prevSkipped = Array.isArray(prevSkippedRaw)
        ? prevSkippedRaw.filter((k): k is string => typeof k === "string")
        : [];
      const nextSkipped = Array.from(new Set([...prevSkipped, attemptedField]));
      try {
        const merged = await args.store.applyFieldPatch(args.profileId, {
          _field_attempts: attempts,
          _skipped_fields: nextSkipped,
        });
        profileAfter = merged as SnapshotProfile;
        retryHint = `auto_skipped_after_${MAX_FIELD_ATTEMPTS}_attempts`;
      } catch { /* non-fatal */ }
    } else {
      try {
        const merged = await args.store.applyFieldPatch(args.profileId, {
          _field_attempts: attempts,
        });
        profileAfter = merged as SnapshotProfile;
      } catch { /* non-fatal */ }
    }
  }

  // 5. Question Director — pick the next field and phrase a question.
  //
  // BUG FIX (2026-05-03 live test): when the current attempt failed
  // (fieldFilled=false), do NOT pass additionalFieldsDetected. Otherwise
  // Question Director's pickNextField gives those volunteered fields
  // priority over the still-pending field, silently leaving the failed
  // one orphaned — the chat moves to a different question while the
  // sidebar still says "Next up: <failed field>".
  //
  // The verification gate above catches WRITE failures; this catches
  // EXTRACTION failures by ensuring the next question stays on the
  // current field until either the auto-skip threshold trips or the
  // user actually answers it.
  const askResult = await askNext(
    profileAfter,
    args.conversationHistory,
    fieldFilled ? extraction.additionalFieldsDetected : [],
    {
      getRequiredFields: (p) => getRequiredFields(p as SnapshotProfile) as AllFieldKey[],
      writer: args.writer,
      profileId: args.profileId,
    },
  );

  const filledFields = computeFilledFields(profileAfter);
  const requiredFields = getRequiredFields(profileAfter) as AllFieldKey[];

  if (askResult.isOnboardingComplete) {
    mascotEvents.push({ kind: "onboarding_complete" });
    return {
      isOnboardingComplete: true,
      attemptedField,
      fieldFilled,
      profileAfter,
      filledFields,
      requiredFields,
      nextPendingField: null,
      questionText:
        "All set — I have everything I need to start building your relocation plan. " +
        "Click \"Generate my plan\" whenever you're ready.",
      animationCue: "celebrating",
      mascotEvents,
      extractorAdditionalFieldsDetected: extraction.additionalFieldsDetected,
      ...(retryHint ? { retryHint } : {}),
    };
  }

  const nextPendingField = (askResult.nextFieldKey as AllFieldKey | undefined) ?? null;
  const questionText = askResult.questionText ?? "What would you like to share next?";
  const animationCue: AnimationCue = askResult.animationCue ?? "tilting_curious";

  mascotEvents.push({
    kind: "question_ready",
    field: nextPendingField ?? undefined,
    animationCue,
  });

  return {
    isOnboardingComplete: false,
    attemptedField,
    fieldFilled,
    profileAfter,
    filledFields,
    requiredFields,
    nextPendingField,
    questionText,
    animationCue,
    mascotEvents,
    extractorAdditionalFieldsDetected: extraction.additionalFieldsDetected,
    ...(retryHint ? { retryHint } : {}),
  };
}

function finaliseAlreadyComplete(
  profile: SnapshotProfile,
  mascotEvents: MascotEvent[],
): OrchestrateCollectingResult {
  mascotEvents.push({ kind: "onboarding_complete" });
  return {
    isOnboardingComplete: true,
    attemptedField: null,
    fieldFilled: false,
    profileAfter: profile,
    filledFields: computeFilledFields(profile),
    requiredFields: getRequiredFields(profile) as AllFieldKey[],
    nextPendingField: null,
    questionText:
      "All set — I have everything I need to start building your relocation plan.",
    animationCue: "celebrating",
    mascotEvents,
    extractorAdditionalFieldsDetected: [],
  };
}

function computeFilledFields(profile: SnapshotProfile): AllFieldKey[] {
  const filled: AllFieldKey[] = [];
  for (const [key, val] of Object.entries(profile)) {
    if (val === null || val === undefined) continue;
    if (typeof val === "string" && val.trim().length === 0) continue;
    filled.push(key as AllFieldKey);
  }
  return filled;
}
