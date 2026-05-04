import { useState, useCallback } from "react";

const STORAGE_KEY = "qv_deleted_messages";

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

export function useDeletedMessages() {
  const [deleted, setDeleted] = useState<Set<number>>(load);

  const deleteForMe = useCallback((id: number) => {
    setDeleted((prev) => {
      const next = new Set(prev);
      next.add(id);
      save(next);
      return next;
    });
  }, []);

  const isDeleted = useCallback((id: number) => deleted.has(id), [deleted]);

  return { deleteForMe, isDeleted };
}
