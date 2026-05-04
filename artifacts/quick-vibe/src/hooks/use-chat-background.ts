import { useState, useCallback } from "react";

export interface Background {
  id: string;
  label: string;
  style: React.CSSProperties;
  previewStyle: React.CSSProperties;
}

export const BACKGROUNDS: Background[] = [
  {
    id: "default",
    label: "Default",
    style: {},
    previewStyle: { background: "hsl(240 10% 4%)" },
  },
  {
    id: "midnight",
    label: "Midnight",
    style: { background: "linear-gradient(160deg, #0f0c29, #302b63, #24243e)" },
    previewStyle: { background: "linear-gradient(160deg, #0f0c29, #302b63)" },
  },
  {
    id: "forest",
    label: "Forest",
    style: { background: "linear-gradient(160deg, #0a1628, #1a2a1a, #0d1f2d)" },
    previewStyle: { background: "linear-gradient(160deg, #0a1628, #1a2a1a)" },
  },
  {
    id: "cosmic",
    label: "Cosmic",
    style: { background: "radial-gradient(ellipse at top, #1a0a2e 0%, #030006 70%)" },
    previewStyle: { background: "radial-gradient(ellipse at top, #1a0a2e 0%, #030006 70%)" },
  },
  {
    id: "ocean",
    label: "Ocean",
    style: { background: "linear-gradient(160deg, #091320, #0d2137, #0a1a2e)" },
    previewStyle: { background: "linear-gradient(160deg, #091320, #0d2137)" },
  },
  {
    id: "amethyst",
    label: "Amethyst",
    style: { background: "linear-gradient(160deg, #11002d, #2d1b69, #1a0533)" },
    previewStyle: { background: "linear-gradient(160deg, #11002d, #2d1b69)" },
  },
  {
    id: "rose",
    label: "Rose Night",
    style: { background: "linear-gradient(160deg, #1a0a14, #2d1420, #1a0a1c)" },
    previewStyle: { background: "linear-gradient(160deg, #1a0a14, #2d1420)" },
  },
  {
    id: "slate",
    label: "Slate",
    style: { background: "linear-gradient(160deg, #1e2a3a, #2d3748, #1a2535)" },
    previewStyle: { background: "linear-gradient(160deg, #1e2a3a, #2d3748)" },
  },
  {
    id: "dots",
    label: "Dots",
    style: {
      background: "hsl(240 10% 5%)",
      backgroundImage: "radial-gradient(circle, rgba(139,92,246,0.15) 1px, transparent 1px)",
      backgroundSize: "24px 24px",
    },
    previewStyle: {
      background: "hsl(240 10% 5%)",
      backgroundImage: "radial-gradient(circle, rgba(139,92,246,0.3) 1px, transparent 1px)",
      backgroundSize: "12px 12px",
    },
  },
  {
    id: "grid",
    label: "Grid",
    style: {
      background: "hsl(240 10% 4%)",
      backgroundImage: "linear-gradient(rgba(139,92,246,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.06) 1px, transparent 1px)",
      backgroundSize: "32px 32px",
    },
    previewStyle: {
      background: "hsl(240 10% 4%)",
      backgroundImage: "linear-gradient(rgba(139,92,246,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.15) 1px, transparent 1px)",
      backgroundSize: "16px 16px",
    },
  },
];

const STORAGE_KEY = "qv_chat_bg";

export function useChatBackground(userId?: number) {
  const storageKey = userId ? `${STORAGE_KEY}_${userId}` : STORAGE_KEY;
  const [bgId, setBgId] = useState<string>(() => {
    try { return localStorage.getItem(storageKey) ?? "default"; } catch { return "default"; }
  });

  const setBackground = useCallback((id: string) => {
    setBgId(id);
    try { localStorage.setItem(storageKey, id); } catch {}
  }, [storageKey]);

  const background = BACKGROUNDS.find((b) => b.id === bgId) ?? BACKGROUNDS[0];
  return { bgId, background, setBackground, backgrounds: BACKGROUNDS };
}
