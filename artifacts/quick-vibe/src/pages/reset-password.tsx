import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, Loader2, MessageSquare, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function getTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("token");
}

type PageState = "form" | "success" | "invalid";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [token] = useState(() => getTokenFromUrl());
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pageState, setPageState] = useState<PageState>(() => token ? "form" : "invalid");

  const passwordStrength = (() => {
    if (password.length === 0) return null;
    if (password.length < 8) return "weak";
    if (password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password)) return "strong";
    return "medium";
  })();

  const strengthColor = {
    weak: "bg-destructive",
    medium: "bg-yellow-500",
    strong: "bg-green-500",
  };
  const strengthLabel = {
    weak: "Too short",
    medium: "Fair",
    strong: "Strong",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${basePath}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400 && (data.error as string)?.includes("invalid")) {
          setPageState("invalid");
        } else {
          setError(data.error || "Something went wrong. Please try again.");
        }
        return;
      }
      setPageState("success");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
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

          {/* ── Invalid / expired token ── */}
          {pageState === "invalid" && (
            <motion.div
              key="invalid"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6 text-center"
            >
              <div className="flex flex-col items-center space-y-3">
                <div className="h-16 w-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold">Link invalid or expired</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    This reset link is no longer valid. Reset links expire after 1 hour and can only be used once.
                  </p>
                </div>
              </div>
              <Button className="w-full h-11 font-semibold" asChild>
                <Link href="/forgot-password">Request a new link</Link>
              </Button>
              <div className="text-center">
                <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Back to sign in
                </Link>
              </div>
            </motion.div>
          )}

          {/* ── Reset form ── */}
          {pageState === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div className="space-y-1.5">
                <h1 className="text-2xl font-bold">Set a new password</h1>
                <p className="text-sm text-muted-foreground">
                  Choose a strong password you haven't used before.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New password */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/90">New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
                      className="pl-9 pr-10 h-11 bg-card border-border/50 focus-visible:ring-primary/40"
                      required
                      autoFocus
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Strength indicator */}
                  <AnimatePresence>
                    {passwordStrength && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-1 overflow-hidden"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${strengthColor[passwordStrength]}`}
                              style={{ width: passwordStrength === "weak" ? "33%" : passwordStrength === "medium" ? "66%" : "100%" }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${
                            passwordStrength === "weak" ? "text-destructive" :
                            passwordStrength === "medium" ? "text-yellow-500" : "text-green-500"
                          }`}>
                            {strengthLabel[passwordStrength]}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/90">Confirm password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repeat your password"
                      value={confirm}
                      onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                      className={`pl-9 pr-10 h-11 bg-card border-border/50 focus-visible:ring-primary/40 ${
                        confirm && confirm !== password ? "border-destructive/50" : ""
                      }`}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowConfirm((v) => !v)}
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirm && confirm !== password && (
                    <p className="text-xs text-destructive">Passwords don't match</p>
                  )}
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
                  disabled={isSubmitting || (!!confirm && confirm !== password)}
                >
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Updating password…</>
                  ) : (
                    "Set new password"
                  )}
                </Button>
              </form>

              <div className="text-center">
                <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Back to sign in
                </Link>
              </div>
            </motion.div>
          )}

          {/* ── Success ── */}
          {pageState === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
              className="space-y-6 text-center"
            >
              <div className="flex flex-col items-center space-y-3">
                <div className="h-16 w-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold">Password updated</h1>
                  <p className="text-sm text-muted-foreground">
                    Your password has been changed successfully. Sign in with your new password.
                  </p>
                </div>
              </div>
              <Button className="w-full h-11 font-semibold" onClick={() => setLocation("/sign-in")}>
                Sign in now
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
