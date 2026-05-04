import { Check } from "lucide-react";
import { BACKGROUNDS, type Background } from "@/hooks/use-chat-background";

interface BackgroundPickerProps {
  currentBgId: string;
  onSelect: (id: string) => void;
}

type Category = "solid" | "gradient" | "pattern";
const CATEGORY_LABELS: Record<Category, string> = {
  pattern: "Patterns",
  gradient: "Gradients",
  solid: "Solid",
};

function groupByCategory(bgs: Background[]) {
  const order: Category[] = ["pattern", "gradient", "solid"];
  const map: Record<string, Background[]> = {};
  for (const bg of bgs) {
    if (!map[bg.category]) map[bg.category] = [];
    map[bg.category].push(bg);
  }
  return order.filter((c) => map[c]?.length).map((c) => ({ category: c, items: map[c] }));
}

export default function BackgroundPicker({ currentBgId, onSelect }: BackgroundPickerProps) {
  const groups = groupByCategory(BACKGROUNDS);

  return (
    <div className="space-y-5">
      {groups.map(({ category, items }) => (
        <div key={category}>
          <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2.5">
            {CATEGORY_LABELS[category as Category]}
          </p>
          <div className="grid grid-cols-5 gap-2.5">
            {items.map((bg) => {
              const isActive = currentBgId === bg.id;
              return (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => onSelect(bg.id)}
                  className="group relative flex flex-col items-center gap-1.5"
                  data-testid={`bg-option-${bg.id}`}
                >
                  <div
                    className={`w-full aspect-square rounded-xl border-2 transition-all overflow-hidden ${
                      isActive
                        ? "border-primary shadow-lg shadow-primary/25 scale-105"
                        : "border-border/30 hover:border-border/70 hover:scale-[1.03]"
                    }`}
                    style={bg.previewStyle}
                  >
                    {isActive && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow-lg">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                  <span className={`text-[9px] font-medium transition-colors leading-tight ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}>
                    {bg.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
