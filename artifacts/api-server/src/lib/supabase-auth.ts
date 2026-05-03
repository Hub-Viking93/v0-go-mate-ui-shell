import { createClient as createSbClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Request, Response } from "express";

const SUPABASE_URL = process.env["SUPABASE_URL"] ?? "";
const SUPABASE_ANON_KEY = process.env["SUPABASE_ANON_KEY"] ?? "";

export interface AuthedContext {
  supabase: SupabaseClient;
  user: { id: string; email?: string | null };
}

export async function authenticate(
  req: Request,
  res: Response,
): Promise<AuthedContext | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).json({ error: "Server is not configured for authentication." });
    return null;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const token = authHeader.slice(7);
  const supabase = createSbClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return { supabase, user: { id: data.user.id, email: data.user.email } };
}

export function getSupabaseAnon(): SupabaseClient {
  return createSbClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
