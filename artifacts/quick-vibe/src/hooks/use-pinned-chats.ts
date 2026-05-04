import { useState, useCallback } from "react";

const STORAGE_KEY = "qv_pinned_chats";

type PinnedChat = { kind: "dm" | "group"; id: number };

function load(): PinnedChat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PinnedChat[];
  } catch {
    return [];
  }
}

function save(items: PinnedChat[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function usePinnedChats() {
  const [pinned, setPinned] = useState<PinnedChat[]>(load);

  const toggle = useCallback((kind: "dm" | "group", id: number) => {
    setPinned((prev) => {
      const exists = prev.some((p) => p.kind === kind && p.id === id);
      const next = exists ? prev.filter((p) => !(p.kind === kind && p.id === id)) : [...prev, { kind, id }];
      save(next);
      return next;
    });
  }, []);

  const isPinned = useCallback((kind: "dm" | "group", id: number) => pinned.some((p) => p.kind === kind && p.id === id), [pinned]);

  return { toggle, isPinned, pinned };
}
