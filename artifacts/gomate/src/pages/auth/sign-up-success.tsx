import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle } from "lucide-react";

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-md flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <img src="/images/gomate-logo.png" alt="GoMate" className="w-10 h-10" />
            <span className="text-2xl font-bold">GoMate</span>
          </div>
        </div>
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-4 pb-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl">Check your email</CardTitle>
              <CardDescription>We sent you a confirmation link to verify your email address</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">What happens next?</p>
                  <p>Click the link in your email to verify your account, then start planning your relocation.</p>
                </div>
              </div>
            </div>
            <Button variant="outline" asChild className="w-full">
              <Link href="/auth/login">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
