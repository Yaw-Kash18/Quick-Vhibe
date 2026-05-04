import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { ChevronDown } from "lucide-react";

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
          className="absolute bottom-full mb-2 z-50"
          style={{ [isMine ? "right" : "left"]: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {showFullPicker ? (
            <div className="shadow-2xl">
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
            <div className="flex items-center gap-0.5 bg-card/95 backdrop-blur-md border border-border/60 rounded-2xl shadow-xl px-1.5 py-1.5">
              {topEmojis.map((emoji) => (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.25 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleSelect(emoji)}
                  className="h-9 w-9 text-xl flex items-center justify-center rounded-xl hover:bg-muted/70 transition-colors"
                  title={emoji}
                >
                  {emoji}
                </motion.button>
              ))}
              <div className="w-px h-5 bg-border/50 mx-0.5 flex-shrink-0" />
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowFullPicker(true)}
                className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted/70 transition-colors text-muted-foreground hover:text-foreground"
                title="More emojis"
              >
                <ChevronDown className="h-4 w-4" />
              </motion.button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
