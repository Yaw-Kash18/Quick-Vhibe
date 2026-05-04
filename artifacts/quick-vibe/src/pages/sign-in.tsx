import { useState } from "react";
import { useSignIn } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Loader2, MessageSquare, Shield, Zap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const result = await signIn!.create({ identifier: email, password });
      if (result.status === "complete") {
        await setActive!({ session: result.createdSessionId });
        setLocation("/chat");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.errors?.[0]?.message || "Invalid email or password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (!isLoaded || isGoogleLoading) return;
    setIsGoogleLoading(true);
    setError("");
    try {
      await signIn!.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${window.location.origin}${basePath}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}${basePath}/chat`,
      });
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Google sign in is not available.");
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left branding panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[46%] px-14 py-12 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0f0a2a 0%, #1e1060 45%, #0a1535 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-10 w-80 h-80 rounded-full opacity-25"
            style={{ background: "radial-gradient(circle, #7c3aed, transparent 65%)", filter: "blur(40px)", animation: "float 7s ease-in-out infinite" }} />
          <div className="absolute bottom-1/4 right-0 w-60 h-60 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #3b82f6, transparent 65%)", filter: "blur(50px)", animation: "float-reverse 9s ease-in-out infinite" }} />
          <div className="absolute top-3/4 left-1/3 w-40 h-40 rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, #ec4899, transparent 65%)", filter: "blur(40px)", animation: "float 5s ease-in-out infinite" }} />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">Quick Vibe</span>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold text-white leading-snug">
              The fastest way<br />to stay connected.
            </h2>
            <p className="text-white/55 text-base leading-relaxed max-w-xs">
              Private, instant messaging built for the way you actually communicate.
            </p>
          </div>

          <div className="space-y-3.5">
            {[
              { icon: Shield, label: "Private & secure by design" },
              { icon: Zap, label: "Real-time message delivery" },
              { icon: Users, label: "Groups, DMs, voice notes" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-3.5 w-3.5 text-white/80" />
                </div>
                <span className="text-sm text-white/65">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs text-white/25">© 2025 Quick Vibe</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-[400px] space-y-7"
        >
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-bold">Quick Vibe</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to continue your conversations</p>
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={isGoogleLoading || !isLoaded}
            className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-border bg-card hover:bg-muted/40 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Continue with Google
          </button>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 border-t border-border/40" />
            <span className="text-xs text-muted-foreground/60 flex-shrink-0">or sign in with email</span>
            <div className="flex-1 border-t border-border/40" />
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
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/90">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  className="pl-9 pr-10 h-11 bg-card border-border/50 focus-visible:ring-primary/40"
                  required
                  autoComplete="current-password"
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
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5"
              >
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold shadow-lg shadow-primary/15"
              disabled={isSubmitting || !isLoaded}
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Signing in…</>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/sign-up" className="text-primary hover:text-primary/80 font-semibold transition-colors">
              Create one
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
