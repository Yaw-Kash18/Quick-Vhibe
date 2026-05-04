import { useState, useCallback } from "react";

export interface Background {
  id: string;
  label: string;
  category: "solid" | "gradient" | "pattern";
  style: React.CSSProperties;
  previewStyle: React.CSSProperties;
}

const dot = (color: string, size = 40) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><circle cx='${size / 2}' cy='${size / 2}' r='1.8' fill='${color}'/><circle cx='0' cy='0' r='1.8' fill='${color}'/><circle cx='${size}' cy='0' r='1.8' fill='${color}'/><circle cx='0' cy='${size}' r='1.8' fill='${color}'/><circle cx='${size}' cy='${size}' r='1.8' fill='${color}'/></svg>`)}")`;

const diamond = (color: string, size = 32) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><path d='M${size / 2} 2L${size - 2} ${size / 2}L${size / 2} ${size - 2}L2 ${size / 2}Z' fill='none' stroke='${color}' stroke-width='1'/></svg>`)}")`;

const wave = (color: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='60' height='30'><path d='M0 15 Q15 3 30 15 Q45 27 60 15' fill='none' stroke='${color}' stroke-width='1.5'/></svg>`)}")`;

const hexagon = (color: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='52' height='45'><polygon points='26,1 51,13.5 51,38.5 26,51 1,38.5 1,13.5' fill='none' stroke='${color}' stroke-width='1'/></svg>`)}")`;

const cross = (color: string, size = 20) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><line x1='${size / 2}' y1='0' x2='${size / 2}' y2='${size}' stroke='${color}' stroke-width='1'/><line x1='0' y1='${size / 2}' x2='${size}' y2='${size / 2}' stroke='${color}' stroke-width='1'/></svg>`)}")`;

export const BACKGROUNDS: Background[] = [
  {
    id: "default",
    label: "Void",
    category: "solid",
    style: {},
    previewStyle: { background: "hsl(240 10% 4%)" },
  },
  {
    id: "telegram",
    label: "Telegram",
    category: "pattern",
    style: {
      background: "#17212b",
      backgroundImage: dot("rgba(255,255,255,0.055)", 40),
      backgroundSize: "40px 40px",
    },
    previewStyle: {
      background: "#17212b",
      backgroundImage: dot("rgba(255,255,255,0.1)", 20),
      backgroundSize: "20px 20px",
    },
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    category: "pattern",
    style: {
      background: "#0b141a",
      backgroundImage: diamond("rgba(255,255,255,0.04)", 32),
      backgroundSize: "32px 32px",
    },
    previewStyle: {
      background: "#0b141a",
      backgroundImage: diamond("rgba(255,255,255,0.08)", 16),
      backgroundSize: "16px 16px",
    },
  },
  {
    id: "waves",
    label: "Waves",
    category: "pattern",
    style: {
      background: "#0e1621",
      backgroundImage: wave("rgba(99,179,237,0.07)"),
      backgroundSize: "60px 30px",
    },
    previewStyle: {
      background: "#0e1621",
      backgroundImage: wave("rgba(99,179,237,0.13)"),
      backgroundSize: "30px 15px",
    },
  },
  {
    id: "hexagons",
    label: "Hex",
    category: "pattern",
    style: {
      background: "#10141e",
      backgroundImage: hexagon("rgba(139,92,246,0.07)"),
      backgroundSize: "52px 45px",
    },
    previewStyle: {
      background: "#10141e",
      backgroundImage: hexagon("rgba(139,92,246,0.14)"),
      backgroundSize: "26px 22.5px",
    },
  },
  {
    id: "grid",
    label: "Grid",
    category: "pattern",
    style: {
      background: "hsl(240 10% 4%)",
      backgroundImage: cross("rgba(139,92,246,0.07)", 24),
      backgroundSize: "24px 24px",
    },
    previewStyle: {
      background: "hsl(240 10% 4%)",
      backgroundImage: cross("rgba(139,92,246,0.14)", 12),
      backgroundSize: "12px 12px",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    category: "gradient",
    style: { background: "linear-gradient(160deg, #0f0c29, #302b63, #24243e)" },
    previewStyle: { background: "linear-gradient(160deg, #0f0c29, #302b63)" },
  },
  {
    id: "aurora",
    label: "Aurora",
    category: "gradient",
    style: { background: "linear-gradient(135deg, #0a0e1a 0%, #0d2137 40%, #091a2e 70%, #0a1f3a 100%)" },
    previewStyle: { background: "linear-gradient(135deg, #0a0e1a, #0d2137)" },
  },
  {
    id: "cosmic",
    label: "Cosmic",
    category: "gradient",
    style: { background: "radial-gradient(ellipse at 30% 20%, #1a0a2e 0%, #030006 60%)" },
    previewStyle: { background: "radial-gradient(ellipse at 30% 20%, #1a0a2e 0%, #030006 70%)" },
  },
  {
    id: "ocean",
    label: "Ocean",
    category: "gradient",
    style: { background: "linear-gradient(160deg, #091320, #0d2137, #0a1a2e)" },
    previewStyle: { background: "linear-gradient(160deg, #091320, #0d2137)" },
  },
  {
    id: "forest",
    label: "Forest",
    category: "gradient",
    style: { background: "linear-gradient(160deg, #0a1628, #1a2a1a, #0d1f2d)" },
    previewStyle: { background: "linear-gradient(160deg, #0a1628, #1a2a1a)" },
  },
  {
    id: "amethyst",
    label: "Amethyst",
    category: "gradient",
    style: { background: "linear-gradient(160deg, #11002d, #2d1b69, #1a0533)" },
    previewStyle: { background: "linear-gradient(160deg, #11002d, #2d1b69)" },
  },
  {
    id: "ember",
    label: "Ember",
    category: "gradient",
    style: { background: "linear-gradient(160deg, #1a0a06, #2d1405, #1a0a0a)" },
    previewStyle: { background: "linear-gradient(160deg, #1a0a06, #2d1405)" },
  },
  {
    id: "rose",
    label: "Rose",
    category: "gradient",
    style: { background: "linear-gradient(160deg, #1a0a14, #2d1420, #1a0a1c)" },
    previewStyle: { background: "linear-gradient(160deg, #1a0a14, #2d1420)" },
  },
  {
    id: "slate",
    label: "Slate",
    category: "gradient",
    style: { background: "linear-gradient(160deg, #1e2a3a, #2d3748, #1a2535)" },
    previewStyle: { background: "linear-gradient(160deg, #1e2a3a, #2d3748)" },
  },
];

const STORAGE_KEY = "qv_chat_bg";

export function useChatBackground(userId?: number) {
  const storageKey = userId ? `${STORAGE_KEY}_${userId}` : STORAGE_KEY;
  const [bgId, setBgId] = useState<string>(() => {
    try { return localStorage.getItem(storageKey) ?? "telegram"; } catch { return "telegram"; }
  });

  const setBackground = useCallback((id: string) => {
    setBgId(id);
    try { localStorage.setItem(storageKey, id); } catch {}
  }, [storageKey]);

  const background = BACKGROUNDS.find((b) => b.id === bgId) ?? BACKGROUNDS[0];
  return { bgId, background, setBackground, backgrounds: BACKGROUNDS };
}
