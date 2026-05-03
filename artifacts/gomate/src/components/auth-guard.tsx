import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { createClient } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";

interface AuthGuardProps {
  children: ReactNode;
  requireAuth?: boolean;
  redirectIfAuthed?: string;
}

export function AuthGuard({ children, requireAuth = true, redirectIfAuthed }: AuthGuardProps) {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (mounted) setSession(sess);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (requireAuth && !session) {
      setLocation("/auth/login");
    } else if (redirectIfAuthed && session) {
      setLocation(redirectIfAuthed);
    }
  }, [session, requireAuth, redirectIfAuthed, setLocation]);

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (requireAuth && !session) return null;
  if (redirectIfAuthed && session) return null;

  return <>{children}</>;
}
