import type { AuthedContext } from "../supabase-auth";

export type GomateVersion = "v1" | "v2";

export const DEFAULT_GOMATE_VERSION: GomateVersion = "v2";

export async function getGomateVersion(ctx: AuthedContext): Promise<GomateVersion> {
  const { data, error } = await ctx.supabase
    .from("profiles")
    .select("gomate_version")
    .eq("id", ctx.user.id)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_GOMATE_VERSION;
  }

  const value = (data as { gomate_version?: string | null }).gomate_version;
  if (value === "v1" || value === "v2") {
    return value;
  }
  return DEFAULT_GOMATE_VERSION;
}
