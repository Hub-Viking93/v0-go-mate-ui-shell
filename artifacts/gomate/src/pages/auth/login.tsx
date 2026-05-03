import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useRouter } from "@/lib/router-compat";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const router = useRouter();

  const handleGuestContinue = async () => {
    const supabase = createClient();
    setIsGuestLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      router.push("/onboarding");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not start guest session");
      setIsGuestLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <img src="/images/gomate-logo.png" alt="GoMate" className="w-10 h-10" />
              <span className="text-2xl font-bold text-foreground">GoMate</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Your AI-powered relocation assistant
            </p>
          </div>

          <Card className="border-border/50 shadow-lg">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-semibold text-center">Welcome back</CardTitle>
              <CardDescription className="text-center">
                Sign in to continue planning your move
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin}>
                <div className="flex flex-col gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
                  </div>
                  {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  )}
                  <Button type="submit" className="w-full h-11" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign in"}
                  </Button>
                </div>
              </form>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11"
                onClick={handleGuestContinue}
                disabled={isGuestLoading || isLoading}
                data-testid="continue-as-guest"
              >
                {isGuestLoading ? "Starting guest session..." : "Continue as guest"}
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Try GoMate without signing up. You can save your progress later.
              </p>
              <div className="mt-6 text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/auth/sign-up" className="font-medium text-primary hover:underline">Create one</Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
