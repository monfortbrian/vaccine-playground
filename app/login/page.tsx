"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconFlask, IconEye, IconEyeOff } from "@tabler/icons-react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";
import { AccessDeniedModal } from "@/components/access-denied-modal";

// ── Right panel -image cover ─────────────────────────────────────────────────

function CoverPanel() {
  return (
    <div className="relative hidden lg:block">
      {/* public/ files are served from / in Next.js -never use ../../public/ */}
      <img
        src="/alphaFold_illustration.jpeg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute bottom-10 left-10 z-10 space-y-1">
        <p className="text-sm font-medium text-white/70 leading-relaxed">
          Orchestrating the future of rapid vaccine discovery.
        </p>
      </div>
    </div>
  );
}

// ── Login form ────────────────────────────────────────────────────────────────

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  const sessionExpired = searchParams.get("reason") === "expired";

  // Single redirect point -fires once when auth-provider confirms user.
  // Do NOT also redirect inside handleSubmit. Doing both causes the blink:
  // handleSubmit pushes to "/" before Supabase onAuthStateChange fires,
  // dashboard layout sees user=null, redirects back to /login, then
  // auth resolves and this useEffect fires again -infinite loop.
  React.useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Please fill in both fields."); return; }
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      // Do NOT call router.replace here.
      // signIn() triggers Supabase onAuthStateChange → auth-provider sets user
      // → useEffect above fires → router.replace("/") runs cleanly.
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      if (msg === "ACCESS_DENIED") {
        setShowAccessDenied(true);
      } else if (msg.includes("Invalid login credentials")) {
        setError("Incorrect email or password.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showAccessDenied && (
        <AccessDeniedModal onClose={() => setShowAccessDenied(false)} />
      )}

      {/* Two-column grid: form left, image right */}
      <div className="flex min-h-svh lg:grid lg:grid-cols-2">

        {/* ── Left: form ──────────────────────────────────── */}
        <div className="flex flex-col bg-background">

          {/* Top bar */}
          <div className="flex items-center gap-2.5 px-8 pt-8">
            <div className="flex size-7 items-center justify-center rounded-lg bg-foreground">
              <IconFlask className="size-4 text-background" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Kozi AI</span>
          </div>

          {/* Form centered vertically */}
          <div className="flex flex-1 items-center justify-center px-8 py-12">
            <div className="w-full max-w-[360px] space-y-8">

              <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Access Kozi Lab
                </h1>
                <p className="text-sm text-muted-foreground">
                  Sign in with your lab credentials.
                </p>
              </div>

              {/* Session expired notice */}
              {sessionExpired && !error && (
                <div className="flex items-start gap-3 rounded-xl border bg-muted/40 px-4 py-3">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your session ended. Pipeline results are preserved -find
                    them in History after signing in.
                  </p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <p className="text-xs text-destructive leading-relaxed">
                    {error}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="researcher@institution.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                    <a
                      href="#"
                      className="text-xs text-muted-foreground underline-offset-4 hover:underline hover:text-foreground transition-colors"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword
                        ? <IconEyeOff className="size-4" />
                        : <IconEye className="size-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 font-medium"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                      Signing in…
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background px-3 text-xs text-muted-foreground">
                    Private beta
                  </span>
                </div>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                No account?{" "}
                <a
                  href="https://kozi-ai.com/contact"
                  className="font-medium text-foreground underline-offset-4 hover:underline transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Request access
                </a>
              </p>
            </div>
          </div>

          {/* Legal */}
          <div className="px-8 pb-8">
            <p className="text-xs text-muted-foreground text-center">
              By signing in you agree to our{" "}
              <a
                href="https://kozi-ai.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Terms
              </a>{" "}
              and{" "}
              <a
                href="https://kozi-ai.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>

        {/* ── Right: image cover ───────────────────────────── */}
        <CoverPanel />

      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center bg-background">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}