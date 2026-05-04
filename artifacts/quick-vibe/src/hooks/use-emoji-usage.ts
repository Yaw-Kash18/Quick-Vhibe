import { useCallback } from "react";

const STORAGE_KEY = "qv_emoji_usage";
const DEFAULT_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

function getUsage(key: string): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(key) ?? "{}"); } catch { return {}; }
}

export function useEmojiUsage(userId?: number) {
  const storageKey = userId ? `${STORAGE_KEY}_${userId}` : STORAGE_KEY;

  const recordUsage = useCallback((emoji: string) => {
    const usage = getUsage(storageKey);
    usage[emoji] = (usage[emoji] ?? 0) + 1;
    try { localStorage.setItem(storageKey, JSON.stringify(usage)); } catch {}
  }, [storageKey]);

  const getTopEmojis = useCallback((count = 5): string[] => {
    const usage = getUsage(storageKey);
    const sorted = Object.entries(usage)
      .sort(([, a], [, b]) => b - a)
      .map(([emoji]) => emoji);
    const result = [...sorted];
    for (const emoji of DEFAULT_EMOJIS) {
      if (result.length >= count) break;
      if (!result.includes(emoji)) result.push(emoji);
    }
    return result.slice(0, count);
  }, [storageKey]);

  return { recordUsage, getTopEmojis };
}
