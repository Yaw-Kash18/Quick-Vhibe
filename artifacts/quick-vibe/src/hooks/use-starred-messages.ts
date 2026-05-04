import { useState, useCallback } from "react";

const STORAGE_KEY = "qv_starred_messages";

function load(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function save(ids: Set<number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function useStarredMessages() {
  const [starred, setStarred] = useState<Set<number>>(load);

  const toggle = useCallback((id: number) => {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      save(next);
      return next;
    });
  }, []);

  const isStarred = useCallback((id: number) => starred.has(id), [starred]);

  return { toggle, isStarred, starred };
}
