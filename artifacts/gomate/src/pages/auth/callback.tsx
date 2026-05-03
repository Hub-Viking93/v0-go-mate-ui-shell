import { useEffect } from "react";
import { useRouter, useSearchParams } from "@/lib/router-compat";
import { createClient } from "@/lib/supabase/client";

const ALLOWED_REDIRECTS = ["/", "/dashboard", "/chat", "/visa", "/checklist", "/guides", "/profile", "/settings"];

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const supabase = createClient();
    const code = params.get("code");
    const rawNext = params.get("next") || "/dashboard";
    const next = ALLOWED_REDIRECTS.includes(rawNext) ? rawNext : "/dashboard";

    async function handleCallback() {
      if (!code) {
        router.replace("/auth/error?message=Missing authentication code");
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        router.replace(`/auth/error?message=${encodeURIComponent(error.message)}`);
      } else {
        router.replace(next);
      }
    }
    handleCallback();
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Completing sign-in...</p>
      </div>
    </div>
  );
}
