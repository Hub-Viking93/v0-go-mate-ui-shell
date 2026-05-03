import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useRouter } from "@/lib/router-compat";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/callback` },
      });
      if (error) throw error;
      router.push("/auth/sign-up-success");
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
            <p className="text-sm text-muted-foreground text-center">Start your relocation journey today</p>
          </div>

          <Card className="border-border/50 shadow-lg">
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-semibold text-center">Create an account</CardTitle>
              <CardDescription className="text-center">Join thousands planning their move abroad</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp}>
                <div className="flex flex-col gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input id="confirm-password" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-11" />
                  </div>
                  {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  )}
                  <div className="flex items-start gap-2.5">
                    <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(c) => setTermsAccepted(c === true)} className="mt-0.5" />
                    <Label htmlFor="terms" className="text-xs text-muted-foreground font-normal cursor-pointer">
                      I agree to the Terms of Service and Privacy Policy. I understand that GoMate provides informational guidance, not legal advice.
                    </Label>
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={isLoading || !termsAccepted}>
                    {isLoading ? "Creating account..." : "Create account"}
                  </Button>
                </div>
              </form>
              <div className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/auth/login" className="font-medium text-primary hover:underline">Sign in</Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
