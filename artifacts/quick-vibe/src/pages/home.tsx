import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-5xl font-bold tracking-tight text-foreground">
          Every conversation feels private and immediate.
        </h1>
        <p className="text-xl text-muted-foreground">
          Tight UI, fluid motion, zero clutter. Built for people who want to get to the message fast.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/sign-up" className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
            Get Started
          </Link>
          <Link href="/sign-in" className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}