import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { MessageSquare, AtSign, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "../App";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateMe, getGetMeQueryKey } from "@workspace/api-client-react";

const usernameRe = /^[a-zA-Z0-9_]+$/;

export default function SetupPage() {
  const { completeSetup } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const updateMe = useUpdateMe();

  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const validate = (v: string) => {
    if (v.length < 3) return "Username must be at least 3 characters";
    if (v.length > 20) return "Username must be at most 20 characters";
    if (!usernameRe.test(v)) return "Only letters, numbers and underscores are allowed";
    return "";
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setUsername(v);
    if (error) setError(validate(v));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(username.trim());
    if (err) { setError(err); return; }

    updateMe.mutate(
      { data: { username: username.trim() } },
      {
        onSuccess: (user) => {
          queryClient.setQueryData(getGetMeQueryKey(), user);
          completeSetup();
          setLocation("/chat");
        },
        onError: () => {
          setError("That username is already taken — try another one.");
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      {/* Background blobs */}
      <div className="pointer-events-none select-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }} />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.05]"
          style={{ background: "radial-gradient(circle, #3b82f6, transparent 70%)" }} />
      </div>

      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="w-full max-w-[420px]"
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-10">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-bold">Quick Vibe</span>
          </div>

          {/* Heading */}
          <div className="mb-8 space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Choose your username</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              This is how other people will find and message you. You can change it later in settings.
            </p>
          </div>

          {/* Rules */}
          <div className="mb-7 grid grid-cols-2 gap-2.5">
            {[
              "3–20 characters",
              "Letters, numbers, _",
              "No spaces allowed",
              "Must be unique",
            ].map((rule) => (
              <div key={rule} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                {rule}
              </div>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/90">Username</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="e.g. johndoe"
                  value={username}
                  onChange={handleChange}
                  className="pl-9 h-12 bg-card border-border/50 focus-visible:ring-primary/40 text-base"
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  data-testid="input-username"
                  disabled={updateMe.isPending}
                />
              </div>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-destructive mt-1"
                >
                  {error}
                </motion.p>
              )}
            </div>

            {username.trim().length >= 3 && !error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-muted-foreground -mt-2"
              >
                Your profile will be visible as <span className="text-primary font-medium">@{username.trim()}</span>
              </motion.p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-sm font-semibold shadow-lg shadow-primary/15 gap-2"
              disabled={updateMe.isPending || username.trim().length < 3}
              data-testid="button-submit-username"
            >
              {updateMe.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
              ) : (
                <>Get started <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
