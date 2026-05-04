import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "qv_pinned_messages";
const EVENT_NAME = "qv-pinned-messages-changed";

interface PinnedMessage {
  id: number;
  content: string;
  senderName: string;
  createdAt: string;
  chatType: "dm" | "group";
  chatId: number;
}

function load(): PinnedMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PinnedMessage[];
  } catch {
    return [];
  }
}

function save(messages: PinnedMessage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function usePinnedMessages(chatType: "dm" | "group", chatId: number) {
  const [pinned, setPinned] = useState<PinnedMessage[]>(load);

  useEffect(() => {
    const handler = () => setPinned(load());
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const pinnedForChat = pinned.filter((p) => p.chatType === chatType && p.chatId === chatId);

  const pin = useCallback((msg: { id: number; content: string; senderName: string; createdAt: string }) => {
    const current = load();
    const exists = current.find((p) => p.id === msg.id);
    if (exists) return;
    const next = [...current, { ...msg, chatType, chatId }];
    save(next);
    setPinned(next);
  }, [chatType, chatId]);

  const unpin = useCallback((id: number) => {
    const current = load();
    const next = current.filter((p) => p.id !== id);
    save(next);
    setPinned(next);
  }, []);

  const isPinned = useCallback((id: number) => pinned.some((p) => p.id === id), [pinned]);

  return { pinnedForChat, pin, unpin, isPinned };
}
