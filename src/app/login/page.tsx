"use client";

import * as React from "react";
import { InstantAPIError } from "@instantdb/core";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Cloud,
  Package,
  ShieldCheck,
  ShoppingBag,
  Store,
} from "lucide-react";
import { INSTANT_APP_ID_CONFIGURED, db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function instantAuthErrorMessage(err: unknown): string {
  if (err instanceof InstantAPIError) {
    const parts = [err.message];
    if (err.hint != null) {
      parts.push(
        typeof err.hint === "string"
          ? err.hint
          : JSON.stringify(err.hint),
      );
    }
    return parts.join(" — ");
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

function maskEmail(email: string): string {
  const trimmed = email.trim();
  const [user, domain] = trimmed.split("@");
  if (!domain || !user) return trimmed;
  const shown = user.slice(0, 2);
  return `${shown}···@${domain}`;
}

export default function LoginPage() {
  const router = useRouter();
  const { isLoading, user } = db.useAuth();

  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [step, setStep] = React.useState<"email" | "code">("email");
  const [busy, setBusy] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!INSTANT_APP_ID_CONFIGURED) {
      setFormError(
        "Sign-in is not configured: set NEXT_PUBLIC_INSTANT_APP_ID to your Instant app id in the host environment (available at build time), then redeploy.",
      );
      return;
    }
    setBusy(true);
    try {
      await db.auth.sendMagicCode({ email });
      setStep("code");
    } catch (err) {
      setFormError(instantAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      await db.auth.signInWithMagicCode({ email, code });
      router.replace("/dashboard");
    } catch (err) {
      setFormError(instantAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <div
          className="size-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        <span className="text-sm">Checking session…</span>
      </div>
    );
  }

  const heroBullets = [
    {
      icon: Package,
      title: "Catalog & stock",
      body: "Low-stock cues before you run empty.",
    },
    {
      icon: ShoppingBag,
      title: "Sales & credit",
      body: "POS flows, installments, pay-later IOUs.",
    },
    {
      icon: Cloud,
      title: "Offline-friendly",
      body: "Work locally; sync queues when you reconnect.",
    },
  ];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(min(100%,420px),540px)] xl:grid-cols-[minmax(0,1fr)_580px]">
      {/* Desktop hero */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-teal-800 to-slate-950 p-10 text-primary-foreground lg:flex xl:p-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)
            `,
            backgroundSize: "52px 52px",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 top-16 size-[min(100vw,28rem)] rounded-full bg-highlight/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-2/5 bg-gradient-to-t from-slate-950/80 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-36 left-1/4 size-96 rounded-full bg-teal-400/15 blur-3xl"
          aria-hidden
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-primary-foreground/15 bg-primary-foreground/12 shadow-lg shadow-black/10 backdrop-blur-md">
              <Store className="size-7" aria-hidden />
            </div>
            <span className="text-xl font-semibold tracking-tight">
              Muna Shop
            </span>
          </div>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary-foreground/90 backdrop-blur-sm">
            Staff workspace
            <ArrowRight className="size-3.5 opacity-80" aria-hidden />
          </p>
          <h1 className="mt-8 max-w-xl text-4xl font-semibold leading-[1.12] tracking-tight xl:text-[2.75rem] xl:leading-[1.1]">
            Run the shop from one calm dashboard.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-primary-foreground/88">
            Track products, sales, installments, and pay-later balances in one
            place — so nothing slips through when it gets busy.
          </p>
        </div>

        <div className="relative mt-12 space-y-6">
          <ul className="grid gap-4 xl:grid-cols-3 xl:gap-5">
            {heroBullets.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="rounded-2xl border border-primary-foreground/12 bg-primary-foreground/[0.07] p-4 shadow-inner shadow-black/10 backdrop-blur-sm transition-colors hover:bg-primary-foreground/[0.1]"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/12">
                    <Icon className="size-[18px] opacity-95" aria-hidden />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold leading-tight">
                      {title}
                    </p>
                    <p className="text-xs leading-snug text-primary-foreground/78">
                      {body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-primary-foreground/85">
            <ShieldCheck
              className="size-5 shrink-0 text-primary-foreground"
              aria-hidden
            />
            <span>
              Magic-link sign-in — no passwords to rotate or stores on devices you
              do not control.
            </span>
          </p>
        </div>
      </aside>

      {/* Mobile brand */}
      <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-primary via-teal-800 to-slate-900 px-6 py-10 text-primary-foreground lg:hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-primary-foreground/15 bg-primary-foreground/12 backdrop-blur-sm">
            <Store className="size-6" aria-hidden />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">Muna Shop</p>
            <p className="text-sm text-primary-foreground/80">
              Inventory · sales · staff sign-in
            </p>
          </div>
        </div>
        <p className="relative mt-5 max-w-md text-sm leading-relaxed text-primary-foreground/88">
          One dashboard for stock, sales, installments, and pay-later balances.
        </p>
      </div>

      {/* Form column */}
      <div className="relative flex flex-1 flex-col justify-center bg-background px-5 py-10 sm:px-10 lg:min-h-0 lg:border-l lg:border-border/60 lg:bg-muted/25 lg:py-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-40 lg:hidden"
          aria-hidden
        >
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/[0.06] to-transparent" />
        </div>

        <div className="relative mx-auto w-full max-w-[520px] xl:max-w-[540px]">
          <div className="mb-8 hidden flex-col items-center gap-1 lg:flex">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Secure access
            </span>
          </div>

          <Card className="border-border/80 shadow-2xl shadow-black/[0.06] ring-1 ring-black/[0.04] dark:border-border dark:shadow-black/50 dark:ring-white/[0.06]">
            <CardHeader className="space-y-2 pb-2 pt-8">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                {step === "email" ? "Welcome back" : "Check your inbox"}
              </CardTitle>
              <CardDescription className="text-base leading-relaxed">
                {step === "email" ? (
                  <>
                    Sign in with your work email. We&apos;ll send a one-time
                    code — no password to remember.
                  </>
                ) : (
                  <>
                    We sent a code to{" "}
                    <span className="font-medium text-foreground">
                      {maskEmail(email)}
                    </span>
                    . Enter it below to continue.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-8 pt-4">
              {step === "email" ? (
                <form className="grid gap-5" onSubmit={sendCode}>
                  {formError ? (
                    <p
                      role="alert"
                      aria-live="polite"
                      className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      {formError}
                    </p>
                  ) : null}
                  <div className="grid gap-2">
                    <Label htmlFor="email">Work email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@shop.com"
                      className="h-12 border-border/90 bg-background shadow-sm transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/35"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 w-full gap-2 shadow-lg shadow-primary/25 transition-[transform,box-shadow] hover:shadow-xl hover:shadow-primary/20 active:scale-[0.99]"
                    disabled={busy}
                  >
                    {busy ? (
                      "Sending…"
                    ) : (
                      <>
                        Email me a code
                        <ArrowRight className="size-4 opacity-90" aria-hidden />
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <form className="grid gap-5" onSubmit={verify}>
                  {formError ? (
                    <p
                      role="alert"
                      aria-live="polite"
                      className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      {formError}
                    </p>
                  ) : null}
                  <div className="grid gap-2">
                    <Label htmlFor="code">6-digit code</Label>
                    <Input
                      id="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      required
                      maxLength={8}
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\s+/g, ""))
                      }
                      placeholder="• • • • • •"
                      className="h-14 border-border/90 bg-background text-center font-mono text-xl tracking-[0.5em] shadow-sm placeholder:tracking-normal placeholder:text-muted-foreground/40 focus-visible:ring-[3px] focus-visible:ring-ring/35"
                    />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 flex-1 border-border/90 bg-background"
                      onClick={() => {
                        setStep("email");
                        setCode("");
                        setFormError(null);
                      }}
                    >
                      Use different email
                    </Button>
                    <Button
                      type="submit"
                      className="h-12 flex-1 gap-2 shadow-lg shadow-primary/20 sm:flex-[1.15]"
                      disabled={busy}
                    >
                      {busy ? (
                        "Signing in…"
                      ) : (
                        <>
                          Enter workspace
                          <ArrowRight className="size-4 opacity-90" aria-hidden />
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    Didn&apos;t get an email? Check spam or wait a minute, then try
                    again from the previous step.
                  </p>
                </form>
              )}
            </CardContent>
          </Card>

          <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
            By signing in you agree this account is for authorised Muna Shop
            staff only.
          </p>
        </div>
      </div>
    </div>
  );
}
