import { Link } from "wouter";
import { motion } from "framer-motion";
import { MessageSquare, Shield, Zap, Users, Mic, Image, Star, ArrowRight } from "lucide-react";

const features = [
  { icon: Shield, title: "Private by default", desc: "Your conversations stay yours" },
  { icon: Zap, title: "Real-time delivery", desc: "Messages arrive instantly" },
  { icon: Users, title: "Groups & DMs", desc: "Chat one-on-one or in groups" },
  { icon: Mic, title: "Voice notes", desc: "Hold to record, release to send" },
  { icon: Image, title: "Media sharing", desc: "Photos, files and more" },
  { icon: Star, title: "Star messages", desc: "Bookmark what matters" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Background blobs */}
      <div className="pointer-events-none select-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)", animation: "pulse-glow 8s ease-in-out infinite" }}
        />
        <div
          className="absolute -bottom-60 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #3b82f6, transparent 70%)", animation: "pulse-glow 10s ease-in-out infinite reverse" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent 70%)", animation: "pulse-glow 6s ease-in-out infinite" }}
        />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5 border-b border-border/20">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/10">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <span className="text-lg font-bold tracking-tight">Quick Vibe</span>
        </div>
        <Link
          href="/sign-in"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign In
        </Link>
      </nav>

      {/* Hero */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6 max-w-2xl"
        >
          {/* Icon */}
          <div className="flex justify-center">
            <div
              className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center shadow-2xl shadow-primary/20"
              style={{ animation: "float 5s ease-in-out infinite" }}
            >
              <MessageSquare className="h-12 w-12 text-primary" />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
              <span className="text-foreground">Message </span>
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #a78bfa, #60a5fa)", backgroundSize: "200% 200%", animation: "gradient-shift 4s ease infinite" }}
              >
                freely.
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Fast, private messaging with voice notes, groups, and beautiful design.
              Built for people who want to connect — not scroll.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-3 justify-center flex-wrap">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all hover:shadow-primary/40 hover:-translate-y-0.5"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-xl border border-border bg-card/50 text-sm font-semibold hover:bg-muted/50 transition-all hover:-translate-y-0.5"
            >
              Sign in
            </Link>
          </div>

          {/* Trust note */}
          <p className="text-xs text-muted-foreground/60">No ads. No tracking. Just messaging.</p>
        </motion.div>

        {/* Feature grid */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-20 w-full max-w-3xl grid grid-cols-2 sm:grid-cols-3 gap-3"
        >
          {features.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.07 }}
              className="flex flex-col gap-2.5 p-4 rounded-2xl bg-card/40 border border-border/30 hover:border-border/60 hover:bg-card/60 transition-all text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center pb-8 pt-4">
        <p className="text-xs text-muted-foreground/40">© 2025 Quick Vibe. Built with care.</p>
      </div>
    </div>
  );
}
