import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Forward, Users, Check } from "lucide-react";
import {
  useListConversations, useListGroups, useSendMessage, useSendGroupMessage,
  getListConversationsQueryKey, getListGroupsQueryKey,
  getListMessagesQueryKey, getListGroupMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ForwardDialogProps {
  open: boolean;
  content: string;
  onClose: () => void;
}

export default function ForwardDialog({ open, content, onClose }: ForwardDialogProps) {
  const [search, setSearch] = useState("");
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const sendDM = useSendMessage();
  const sendGroup = useSendGroupMessage();

  const { data: conversations = [] } = useListConversations({
    query: { enabled: open, queryKey: getListConversationsQueryKey() },
  });
  const { data: groups = [] } = useListGroups({
    query: { enabled: open, queryKey: getListGroupsQueryKey() },
  });

  const dmItems = conversations.map((c) => ({
    kind: "dm" as const,
    id: c.id,
    name: c.otherUser.displayName || c.otherUser.username,
    avatarUrl: c.otherUser.avatarUrl,
  }));
  const groupItems = groups.map((g) => ({
    kind: "group" as const,
    id: g.id,
    name: g.name,
    avatarUrl: null as string | null,
  }));

  const allItems = [...dmItems, ...groupItems].filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSend = (kind: "dm" | "group", id: number) => {
    const key = `${kind}-${id}`;
    if (sentTo.has(key)) return;
    if (kind === "dm") {
      sendDM.mutate(
        { id, data: { content, mediaUrl: null, mediaType: null } as any },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(id, {}) }); setSentTo((s) => new Set([...s, key])); } }
      );
    } else {
      sendGroup.mutate(
        { id, data: { content, mediaUrl: null, mediaType: null } as any },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListGroupMessagesQueryKey(id, {}) }); setSentTo((s) => new Set([...s, key])); } }
      );
    }
  };

  const handleClose = () => {
    setSentTo(new Set());
    setSearch("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.96 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed z-50 bottom-0 left-0 right-0 sm:left-1/2 sm:-translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:max-w-sm w-full bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border/30 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/20">
              <div className="flex items-center gap-2">
                <Forward className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Forward message</span>
              </div>
              <button onClick={handleClose} className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-3 py-2 border-b border-border/10">
              <p className="text-xs text-muted-foreground px-1 mb-2 truncate italic">"{content.slice(0, 80)}{content.length > 80 ? "..." : ""}"</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  className="w-full bg-muted/50 rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50"
                  placeholder="Search conversations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {allItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No conversations found</div>
              ) : (
                allItems.map((item) => {
                  const key = `${item.kind}-${item.id}`;
                  const sent = sentTo.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => handleSend(item.kind, item.id)}
                      disabled={sent}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${sent ? "opacity-70" : "hover:bg-muted/40 active:bg-muted/60"}`}
                    >
                      {item.kind === "group" ? (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ) : (
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarImage src={item.avatarUrl ?? undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">{item.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.kind === "group" ? "Group" : "Direct message"}</p>
                      </div>
                      {sent ? (
                        <span className="flex items-center gap-1 text-xs text-primary font-medium flex-shrink-0">
                          <Check className="h-3.5 w-3.5" />Sent
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground flex-shrink-0">Send</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
