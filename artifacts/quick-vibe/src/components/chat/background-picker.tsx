import { Check } from "lucide-react";
import { BACKGROUNDS } from "@/hooks/use-chat-background";

interface BackgroundPickerProps {
  currentBgId: string;
  onSelect: (id: string) => void;
}

export default function BackgroundPicker({ currentBgId, onSelect }: BackgroundPickerProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {BACKGROUNDS.map((bg) => (
        <button
          key={bg.id}
          type="button"
          onClick={() => onSelect(bg.id)}
          className="group relative flex flex-col items-center gap-1.5"
          data-testid={`bg-option-${bg.id}`}
        >
          <div
            className={`w-full aspect-video rounded-lg border-2 transition-all ${
              currentBgId === bg.id ? "border-primary shadow-md shadow-primary/30" : "border-border/40 hover:border-border"
            }`}
            style={bg.previewStyle}
          >
            {currentBgId === bg.id && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow-lg">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              </div>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">{bg.label}</span>
        </button>
      ))}
    </div>
  );
}
