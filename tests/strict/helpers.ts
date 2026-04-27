import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

export function loadEnv() {
  if (!existsSync(".env.local")) return
  for (const raw of readFileSync(".env.local", "utf8").split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const i = line.indexOf("=")
    if (i === -1) continue
    const k = line.slice(0, i).trim()
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

export function envOrThrow(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

export function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true })
}

export function writeJson(path: string, value: unknown) {
  ensureDir(dirname(path))
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n")
}

export function writeText(path: string, value: string) {
  ensureDir(dirname(path))
  writeFileSync(path, value)
}

export function normalize(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function nowIso(): string {
  return new Date().toISOString()
}
