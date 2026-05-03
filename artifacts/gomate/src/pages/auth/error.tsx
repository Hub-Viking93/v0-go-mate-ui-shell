import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useSearchParams } from "@/lib/router-compat";

export default function AuthErrorPage() {
  const params = useSearchParams();
  const message = params.get("message") || "We encountered an error during authentication. Please try again.";

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-md flex flex-col gap-8">
        <div className="flex items-center justify-center gap-3">
          <img src="/images/gomate-logo.png" alt="GoMate" className="w-10 h-10" />
          <span className="text-2xl font-bold">GoMate</span>
        </div>
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-4 pb-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Something went wrong</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/auth/login">Back to sign in</Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/auth/sign-up">Create an account</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
