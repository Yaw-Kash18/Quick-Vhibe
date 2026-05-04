import { useState, useCallback } from "react";

const STORAGE_KEY = "qv_starred_messages";
const STORAGE_META_KEY = "qv_starred_messages_meta";

export interface StarredMeta {
  id: number;
  content: string;
  senderName: string;
  createdAt: string;
}

function loadIds(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function loadMeta(): Map<number, StarredMeta> {
  try {
    const raw = localStorage.getItem(STORAGE_META_KEY);
    if (!raw) return new Map();
    const arr = JSON.parse(raw) as StarredMeta[];
    return new Map(arr.map((m) => [m.id, m]));
  } catch {
    return new Map();
  }
}

function saveIds(ids: Set<number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

function saveMeta(meta: Map<number, StarredMeta>) {
  localStorage.setItem(STORAGE_META_KEY, JSON.stringify([...meta.values()]));
}

export function useStarredMessages() {
  const [starred, setStarred] = useState<Set<number>>(loadIds);
  const [meta, setMeta] = useState<Map<number, StarredMeta>>(loadMeta);

  const toggle = useCallback((id: number, msgMeta?: Omit<StarredMeta, "id">) => {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setMeta((m) => {
          const nm = new Map(m);
          nm.delete(id);
          saveMeta(nm);
          return nm;
        });
      } else {
        next.add(id);
        if (msgMeta) {
          setMeta((m) => {
            const nm = new Map(m);
            nm.set(id, { id, ...msgMeta });
            saveMeta(nm);
            return nm;
          });
        }
      }
      saveIds(next);
      return next;
    });
  }, []);

  const isStarred = useCallback((id: number) => starred.has(id), [starred]);

  const getStarredMessages = useCallback(
    () => [...meta.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [meta]
  );

  return { toggle, isStarred, starred, getStarredMessages };
}
