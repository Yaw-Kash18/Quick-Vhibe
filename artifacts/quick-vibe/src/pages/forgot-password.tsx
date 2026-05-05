import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Loader2, MessageSquare, ArrowLeft, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type ViewState = "form" | "success";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<ViewState>("form");
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${basePath}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      // Capture the reset URL if the server returned one
      setResetUrl(data.resetUrl ?? null);
      // Always transition to success view regardless of whether a URL was returned
      setView("success");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (!resetUrl) return;
    navigator.clipboard.writeText(resetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[420px]"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-bold">Quick Vibe</span>
        </div>

        <AnimatePresence mode="wait">

          {/* ── Request form ── */}
          {view === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div className="space-y-1.5">
                <h1 className="text-2xl font-bold">Forgot your password?</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Enter the email address you signed up with and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/90">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      className="pl-9 h-11 bg-card border-border/50 focus-visible:ring-primary/40"
                      required
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-semibold shadow-lg shadow-primary/15"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</>
                    : "Send reset link"
                  }
                </Button>
              </form>

              <div className="text-center">
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to sign in
                </Link>
              </div>
            </motion.div>
          )}

          {/* ── Success / reset link ── */}
          {view === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="h-16 w-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold">Reset link ready</h1>
                  <p className="text-sm text-muted-foreground">
                    {resetUrl
                      ? <>Click the button below to reset your password for <strong>{email}</strong>.</>
                      : <>If <strong>{email}</strong> has an account, a reset link will appear here.</>
                    }
                  </p>
                </div>
              </div>

              {resetUrl ? (
                <>
                  {/* Reset link card */}
                  <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Your reset link</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 truncate">
                        {resetUrl}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 flex-shrink-0"
                        onClick={handleCopy}
                        title="Copy link"
                      >
                        {copied
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          : <Copy className="h-3.5 w-3.5" />
                        }
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground/60">This link expires in 1 hour.</p>
                  </div>

                  <Button
                    className="w-full h-11 text-sm font-semibold gap-2"
                    onClick={() => window.location.href = resetUrl}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open reset link
                  </Button>
                </>
              ) : (
                <div className="rounded-xl border border-border/40 bg-muted/20 px-5 py-4 text-sm text-muted-foreground text-center leading-relaxed">
                  No account was found for that email address, or it uses Google Sign-In which doesn't have a password to reset.
                </div>
              )}

              <div className="text-center">
                <button
                  onClick={() => { setView("form"); setResetUrl(null); setEmail(""); }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Try a different email
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
