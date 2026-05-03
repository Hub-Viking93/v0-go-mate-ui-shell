// Apply v2 SQL migrations to Supabase Postgres directly.
// Uses pg via the Supabase pooler URL (constructed from project ref).
//
// We don't have DATABASE_URL in env. Instead, use the Supabase REST
// endpoint /pg/* or construct a pooler URL from project ref + service key
// (no — service key isn't a Postgres password).
//
// Simplest: just print out the SQL files and rely on the Supabase SQL
// editor. But the user said "Du kan köra alla SQLs via editor" — they
// want me to run them. The only way to run SQL programmatically is with
// a Postgres connection.
//
// Workaround: many Supabase projects have a `query` or `execute_sql`
// RPC enabled. Check if one exists by trying to call it.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const MIGRATIONS_DIR = '/Users/axel/Downloads/v0-go-mate-ui-shell-main/lib/db/migrations'

const sb = createClient(SUPABASE_URL, SVC)

// Try common RPC names
for (const fn of ['exec_sql', 'execute_sql', 'sql', 'query']) {
  const { error } = await sb.rpc(fn, { sql: 'select 1' })
  console.log(fn, '→', error ? error.code + ' ' + error.message?.slice(0, 80) : 'OK')
}
