import { motion, AnimatePresence } from "framer-motion";
import { X, Star } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { useStarredMessages } from "@/hooks/use-starred-messages";

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
  return format(d, "MMM d, h:mm a");
}

interface StarredMessagesPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function StarredMessagesPanel({ open, onClose }: StarredMessagesPanelProps) {
  const { getStarredMessages, toggle } = useStarredMessages();
  const messages = getStarredMessages();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 h-full w-full max-w-sm z-50 bg-card border-r border-border/30 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-border/30 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                <h2 className="text-base font-semibold">Starred Messages</h2>
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
                  <Star className="h-10 w-10 text-muted-foreground/20" />
                  <p className="text-sm font-medium text-muted-foreground">No starred messages</p>
                  <p className="text-xs text-muted-foreground/60">Long-press any message and tap Star to save it here</p>
                </div>
              ) : (
                <div className="divide-y divide-border/20">
                  {messages.map((msg) => (
                    <div key={msg.id} className="px-4 py-3.5 hover:bg-muted/20 transition-colors group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-semibold text-primary truncate">{msg.senderName}</span>
                            <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">{formatTime(msg.createdAt)}</span>
                          </div>
                          <p className="text-sm text-foreground/90 break-words leading-relaxed">{msg.content}</p>
                        </div>
                        <button
                          onClick={() => toggle(msg.id)}
                          className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted/60 text-yellow-400 hover:text-muted-foreground transition-all"
                          title="Unstar"
                        >
                          <Star className="h-3.5 w-3.5 fill-current" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
