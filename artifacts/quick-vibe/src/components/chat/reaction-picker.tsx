import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { Grid3X3 } from "lucide-react";

interface ReactionPickerProps {
  open: boolean;
  isMine: boolean;
  topEmojis: string[];
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function ReactionPicker({ open, isMine, topEmojis, onSelect, onClose }: ReactionPickerProps) {
  const [showFullPicker, setShowFullPicker] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setShowFullPicker(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setShowFullPicker(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 6, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.88 }}
          transition={{ type: "spring", damping: 22, stiffness: 380 }}
          className="absolute bottom-full mb-2 z-[60]"
          style={{ [isMine ? "right" : "left"]: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {showFullPicker ? (
            <div className="shadow-2xl rounded-2xl overflow-hidden border border-border/40">
              <Picker
                data={data}
                onEmojiSelect={(e: { native: string }) => handleSelect(e.native)}
                theme="dark"
                previewPosition="none"
                skinTonePosition="none"
                maxFrequentRows={2}
              />
            </div>
          ) : (
            <div className="flex items-center gap-0.5 bg-card/95 backdrop-blur-md border border-border/60 rounded-2xl shadow-xl px-2 py-2">
              {topEmojis.map((emoji) => (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => handleSelect(emoji)}
                  className="h-10 w-10 text-2xl flex items-center justify-center rounded-xl hover:bg-muted/70 transition-colors active:bg-muted"
                  title={emoji}
                >
                  {emoji}
                </motion.button>
              ))}
              <div className="w-px h-6 bg-border/50 mx-1 flex-shrink-0" />
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => { e.stopPropagation(); setShowFullPicker(true); }}
                className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-muted/70 transition-colors text-muted-foreground hover:text-foreground active:bg-muted"
                title="More emojis"
              >
                <Grid3X3 className="h-4 w-4" />
              </motion.button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
