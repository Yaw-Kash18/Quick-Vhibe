import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "qv_deleted_messages";
const EVENT_NAME = "qv-deleted-messages-changed";

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
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function useDeletedMessages() {
  const [deleted, setDeleted] = useState<Set<number>>(load);

  useEffect(() => {
    const handler = () => setDeleted(load());
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const deleteForMe = useCallback((id: number) => {
    const next = new Set(load());
    next.add(id);
    save(next);
    setDeleted(next);
  }, []);

  const isDeleted = useCallback((id: number) => deleted.has(id), [deleted]);

  return { deleteForMe, isDeleted };
}
