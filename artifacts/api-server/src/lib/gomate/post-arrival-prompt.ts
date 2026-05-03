// =============================================================
// SNAPSHOT of buildPostArrivalSystemPrompt from
// artifacts/gomate/src/lib/gomate/system-prompt.ts (lines 639+).
// =============================================================
// Used by the new chat orchestrator (chat.ts) when the plan stage
// is "arrived" — we hand off to a settling-in coach rather than the
// onboarding multi-agent flow.
//
// TODO[wave-2.x-unify-schema]: when system-prompt.ts moves into a
// shared workspace package, delete this snapshot.
// =============================================================

export interface PostArrivalProfile {
  destination?: string | null;
  nationality?: string | null;
  occupation?: string | null;
  arrivalDate?: string | null;
}

export interface SettlingTask {
  title: string;
  category: string;
  status: string;
  deadline_days?: number | null;
  is_legal_requirement?: boolean;
}

const MAX_TASK_CHARS = 6000;

export function buildPostArrivalSystemPrompt(
  profile: PostArrivalProfile,
  settlingTasks: SettlingTask[],
): string {
  const city = profile.destination || "your destination";
  const nationality = profile.nationality || "unspecified";
  const occupation = profile.occupation || "unspecified";
  const arrival = profile.arrivalDate || "recently";

  const tasksByCategory: Record<string, SettlingTask[]> = {};
  for (const t of settlingTasks) {
    if (!tasksByCategory[t.category]) tasksByCategory[t.category] = [];
    tasksByCategory[t.category].push(t);
  }

  const taskSummary = Object.entries(tasksByCategory)
    .map(([cat, tasks]) => {
      const done = tasks.filter((t) => t.status === "completed").length;
      const urgent = tasks.filter(
        (t) => t.is_legal_requirement && t.status !== "completed",
      );
      let line = `  ${cat}: ${done}/${tasks.length} complete`;
      if (urgent.length > 0) {
        line += ` (${urgent.length} legal requirement${urgent.length > 1 ? "s" : ""} pending)`;
      }
      return line;
    })
    .join("\n");

  const incompleteTasks = settlingTasks
    .filter((t) => t.status !== "completed" && t.status !== "skipped")
    .sort((a, b) => {
      if (a.status === "overdue" && b.status !== "overdue") return -1;
      if (b.status === "overdue" && a.status !== "overdue") return 1;
      const aDl = a.deadline_days ?? 9999;
      const bDl = b.deadline_days ?? 9999;
      if (aDl !== bDl) return aDl - bDl;
      if (a.is_legal_requirement && !b.is_legal_requirement) return -1;
      if (b.is_legal_requirement && !a.is_legal_requirement) return 1;
      return 0;
    });

  let taskChars = 0;
  let truncatedCount = 0;
  const pendingTaskLines: string[] = [];
  for (const t of incompleteTasks) {
    let line = `  - "${t.title}" [${t.category}]`;
    if (t.status === "overdue") line += " (OVERDUE)";
    else if (t.is_legal_requirement) line += " (LEGAL REQUIREMENT)";
    if (t.deadline_days) line += ` — deadline: ${t.deadline_days} days after arrival`;
    if (taskChars + line.length > MAX_TASK_CHARS) {
      truncatedCount = incompleteTasks.length - pendingTaskLines.length;
      break;
    }
    pendingTaskLines.push(line);
    taskChars += line.length;
  }
  if (truncatedCount > 0) {
    pendingTaskLines.push(
      `  ...and ${truncatedCount} more task${truncatedCount > 1 ? "s" : ""}`,
    );
  }
  const pendingTasks = pendingTaskLines.join("\n");
  const completedTasks = settlingTasks
    .filter((t) => t.status === "completed")
    .map((t) => `  - "${t.title}"`)
    .join("\n");

  return `You are GoMate, a post-arrival relocation assistant. The user has arrived in ${city} (arrived: ${arrival}).

## User Profile
- Nationality: ${nationality}
- Occupation: ${occupation}
- Destination: ${city}

## Settling-In Progress Summary
${taskSummary || "  No tasks generated yet."}

## Pending Tasks
${pendingTasks || "  All tasks complete!"}

## Completed Tasks
${completedTasks || "  None yet."}

## Your Role
You are now a **settling-in coach**. Your job is to:
1. Help the user navigate their first weeks in ${city}
2. Answer practical questions about daily life, bureaucracy, local norms
3. Guide them through their settling-in tasks in priority order
4. Flag urgent legal deadlines and compliance requirements

Be warm, practical, and concise. Cite official sources whenever possible.`;
}
