import { existsSync, readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

if (existsSync(".env.local")) {
  for (const raw of readFileSync(".env.local", "utf8").split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const i = line.indexOf("=")
    if (i === -1) continue
    const k = line.slice(0, i).trim()
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const sql = readFileSync("supabase/migrations/20260427230000_add_cost_of_living_estimates.sql", "utf8")
console.log("Applying migration...")
const { data, error } = await sb.rpc("exec_sql", { sql }).catch((err) => ({ data: null, error: err }))
if (error) {
  console.warn("rpc(exec_sql) not available, trying via REST. Error:", error?.message || error)
  // Fallback: split statements and use the SQL editor via the REST proxy.
  console.error("Manual apply required. SQL written to:")
  console.error("  supabase/migrations/20260427230000_add_cost_of_living_estimates.sql")
  console.error("Apply it in the Supabase Studio SQL editor or via supabase CLI.")
  process.exit(2)
}
console.log("done")
