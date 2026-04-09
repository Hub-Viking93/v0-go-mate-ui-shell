import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getUserTier, hasFeatureAccess } from "@/lib/gomate/tier"
import { isPostArrivalStage } from "@/lib/gomate/post-arrival"

interface TaskRow {
  id: string
  title: string
  description: string | null
  deadline_at: string | null
  is_legal_requirement: boolean | null
  official_link: string | null
  status: string | null
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

function toICalDate(isoDate: string): string {
  const d = new Date(isoDate)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

function addHours(isoDate: string, hours: number): string {
  const d = new Date(isoDate)
  d.setUTCHours(d.getUTCHours() + hours)
  return d.toISOString()
}

function buildICalString(tasks: TaskRow[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GoMate//Compliance Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ]

  for (const task of tasks) {
    if (!task.deadline_at) continue

    const descParts: string[] = []
    if (task.description) descParts.push(task.description)
    if (task.official_link) descParts.push(`Official: ${task.official_link}`)
    const description = descParts.length > 0 ? escapeICalText(descParts.join("\n\n")) : ""

    lines.push("BEGIN:VEVENT")
    lines.push(`UID:${task.id}@gomate`)
    lines.push(`DTSTART:${toICalDate(task.deadline_at)}`)
    lines.push(`DTEND:${toICalDate(addHours(task.deadline_at, 1))}`)
    lines.push(`SUMMARY:${escapeICalText(task.title)}`)
    if (description) lines.push(`DESCRIPTION:${description}`)
    lines.push("CATEGORIES:GOMATE,COMPLIANCE")
    lines.push("BEGIN:VALARM")
    lines.push("ACTION:DISPLAY")
    lines.push("TRIGGER:-P7D")
    lines.push(`DESCRIPTION:Reminder: ${escapeICalText(task.title)}`)
    lines.push("END:VALARM")
    lines.push("END:VEVENT")
  }

  lines.push("END:VCALENDAR")
  return lines.join("\r\n")
}

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tier = await getUserTier(user.id)
  if (!hasFeatureAccess(tier, "compliance_calendar")) {
    return NextResponse.json({ error: "Pro+ required" }, { status: 403 })
  }

  const { data: plan } = await supabase
    .from("relocation_plans")
    .select("id, stage")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle()

  if (!plan) {
    return NextResponse.json({ error: "No active plan found" }, { status: 404 })
  }

  if (!isPostArrivalStage(plan.stage)) {
    return NextResponse.json({ error: "Only available after arrival" }, { status: 400 })
  }

  const { data: tasks, error } = await supabase
    .from("settling_in_tasks")
    .select("id, title, description, deadline_at, is_legal_requirement, official_link, status")
    .eq("plan_id", plan.id)
    .eq("is_legal_requirement", true)
    .not("deadline_at", "is", null)
    .order("deadline_at")

  if (error) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
  }

  const icsContent = buildICalString((tasks || []) as TaskRow[])

  return new Response(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=gomate-compliance-calendar.ics",
    },
  })
}
