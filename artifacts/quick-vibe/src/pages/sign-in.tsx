import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Loader2, MessageSquare, Shield, Zap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "../App";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// Backend-generated temporary username pattern (e.g. user_3f2a1b4c)
const AUTO_USERNAME_RE = /^user_[0-9a-f]{8}$/;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: any) => void;
          renderButton: (el: HTMLElement, cfg: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface ResolvedDestination {
  path: "/setup" | "/chat" | "/admin";
  role: string;
}

export default function SignInPage() {
  const { signIn, requireSetup, setUserRole } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const scriptId = "google-gsi";
    if (document.getElementById(scriptId)) {
      if (window.google) setGoogleReady(true);
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => setGoogleReady(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!googleReady || !GOOGLE_CLIENT_ID || !googleBtnRef.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: "filled_black",
      size: "large",
      width: googleBtnRef.current.offsetWidth || 400,
      text: "signin_with",
    });
  }, [googleReady]);

  // After receiving a token, fetch the user profile to determine:
  // 1. Whether they still need to set a username (auto-generated = needs setup)
  // 2. Their role (admin → /admin, user → /chat)
  const resolveDestination = async (token: string): Promise<ResolvedDestination> => {
    try {
      const res = await fetch(`${basePath}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { path: "/chat", role: "user" };
      const user = await res.json();
      const role: string = user.role ?? "user";
      if (user.username && AUTO_USERNAME_RE.test(user.username)) {
        requireSetup();
        return { path: "/setup", role };
      }
      if (role === "admin") return { path: "/admin", role };
      return { path: "/chat", role };
    } catch {
      return { path: "/chat", role: "user" };
    }
  };

  const handleGoogleCredential = async (response: { credential: string }) => {
    setError("");
    setIsSubmitting(true);
    try {
      const res = await fetch(`${basePath}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Google sign-in failed."); return; }
      if (data.isNewUser) {
        signIn(data.token, true, "user");
        setLocation("/setup");
      } else {
        const dest = await resolveDestination(data.token);
        signIn(data.token, false, dest.role);
        setLocation(dest.path);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${basePath}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid email or password."); return; }
      const dest = await resolveDestination(data.token);
      signIn(data.token, false, dest.role);
      setLocation(dest.path);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
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
              { icon: Users, label: "Groups, DMs, and more" },
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

          {GOOGLE_CLIENT_ID && (
            <div className="space-y-3">
              <div ref={googleBtnRef} className="w-full overflow-hidden rounded-lg" />
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-xs text-muted-foreground">or continue with email</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>
            </div>
          )}

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
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground/90">Password</label>
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  Forgot password?
                </Link>
              </div>
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
              disabled={isSubmitting}
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
