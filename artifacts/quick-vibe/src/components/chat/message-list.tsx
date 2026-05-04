import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListMessages, getListMessagesQueryKey, useMarkConversationRead,
  getListConversationsQueryKey, useGetTypingStatus, getGetTypingStatusQueryKey,
  useEditMessage, useToggleReaction, useDeleteMessage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format, isToday, isYesterday } from "date-fns";
import { Pencil, Check, X, Download, FileIcon, Reply, Forward, Star, Trash2, SmilePlus, CheckCheck, Copy } from "lucide-react";
import { useEmojiUsage } from "@/hooks/use-emoji-usage";
import { useStarredMessages } from "@/hooks/use-starred-messages";
import { useDeletedMessages } from "@/hooks/use-deleted-messages";
import ReactionPicker from "./reaction-picker";
import ForwardDialog from "./forward-dialog";
import type { CSSProperties } from "react";

interface User { id: number; username: string; displayName: string | null; avatarUrl: string | null; }
interface Reaction { emoji: string; count: number; userIds: number[]; }
interface ReplyTo { id: number; content: string; senderName: string; }
interface MessageListProps {
  conversationId: number;
  currentUser: User;
  backgroundStyle?: CSSProperties;
  searchQuery?: string;
  replyTo?: ReplyTo | null;
  onReply?: (msg: ReplyTo) => void;
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1">
      {[0, 1, 2].map((i) => (
        <motion.div key={i} className="h-2 w-2 rounded-full bg-muted-foreground/60" animate={{ y: ["0%", "-50%", "0%"] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }} />
      ))}
    </div>
  );
}

function formatMessageTime(date: Date): string {
  if (isToday(date)) return format(date, "h:mm a");
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`;
  return format(date, "MMM d, h:mm a");
}

function MediaDisplay({ url, type, name }: { url: string; type: string; name?: string }) {
  if (type.startsWith("image/")) {
    return <img src={url} alt="attachment" className="max-w-[240px] max-h-[300px] rounded-xl object-cover mt-1 cursor-pointer" onClick={() => window.open(url, "_blank")} />;
  }
  if (type.startsWith("audio/")) {
    return <audio controls src={url} className="mt-1 max-w-[240px] h-10 rounded-xl" />;
  }
  return (
    <a href={url} download={name ?? "file"} className="flex items-center gap-2 bg-black/20 rounded-xl px-3 py-2 mt-1 hover:bg-black/30 transition-colors">
      <FileIcon className="h-4 w-4 flex-shrink-0" />
      <span className="text-xs truncate max-w-[180px]">{name ?? "Download file"}</span>
      <Download className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
    </a>
  );
}

function ReactionPills({ reactions, currentUserId, onToggle }: { reactions: Reaction[]; currentUserId: number; onToggle: (emoji: string) => void }) {
  if (reactions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {reactions.map((r) => {
        const mine = r.userIds.includes(currentUserId);
        return (
          <motion.button key={r.emoji} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={() => onToggle(r.emoji)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors select-none ${mine ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/50 border-border/30 hover:bg-muted text-foreground"}`}>
            <span className="text-base leading-none">{r.emoji}</span>
            <span className="font-medium tabular-nums">{r.count}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function ReplyQuote({ replyTo, isMine }: { replyTo: ReplyTo; isMine: boolean }) {
  return (
    <div className={`flex items-start gap-1.5 mb-1 px-2.5 py-1.5 rounded-xl rounded-b-none border-l-2 ${isMine ? "bg-primary-foreground/10 border-primary-foreground/40" : "bg-muted border-primary/40"} max-w-[220px]`}>
      <div className="min-w-0">
        <p className={`text-[10px] font-semibold truncate ${isMine ? "text-primary-foreground/60" : "text-primary"}`}>{replyTo.senderName}</p>
        <p className={`text-xs truncate opacity-70 ${isMine ? "text-primary-foreground" : "text-foreground"}`}>{replyTo.content}</p>
      </div>
    </div>
  );
}

interface ContextMenuState { msg: any; x: number; y: number; }

function MessageBubble({ msg, isMine, isGrouped, isLast, currentUser, conversationId, onEditStart, isEditing, editContent, setEditContent, onEditSave, onEditCancel, topEmojis, onRecord, onReply, isLastSeen }: {
  msg: any; isMine: boolean; isGrouped: boolean; isLast: boolean;
  currentUser: User; conversationId: number;
  onEditStart: (id: number, content: string) => void;
  isEditing: boolean; editContent: string; setEditContent: (v: string) => void;
  onEditSave: () => void; onEditCancel: () => void;
  topEmojis: string[]; onRecord: (emoji: string) => void;
  onReply: (msg: any) => void;
  isLastSeen: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const swipeActive = useRef(false);
  const queryClient = useQueryClient();
  const toggleReaction = useToggleReaction();
  const deleteMsg = useDeleteMessage();
  const editRef = useRef<HTMLTextAreaElement>(null);
  const { toggle: toggleStar, isStarred } = useStarredMessages();
  const { deleteForMe } = useDeletedMessages();

  useEffect(() => { if (isEditing && editRef.current) { editRef.current.focus(); editRef.current.select(); } }, [isEditing]);

  const openContext = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({ msg, x: rect.left + rect.width / 2, y: rect.top });
  }, [msg]);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePressStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    longPressTimer.current = setTimeout(() => { openContext(e); }, 500);
  }, [openContext]);

  const handlePressEnd = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => { openContext(e); }, [openContext]);

  const handleReaction = (emoji: string) => {
    onRecord(emoji);
    setPickerOpen(false);
    setContextMenu(null);
    toggleReaction.mutate(
      { id: conversationId, messageId: msg.id, data: { emoji } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(conversationId, {}) }) }
    );
  };

  const handleDeleteForEveryone = () => {
    setContextMenu(null);
    // Optimistic: remove from cache immediately
    queryClient.setQueryData(getListMessagesQueryKey(conversationId, {}), (old: any[]) =>
      old ? old.filter((m) => m.id !== msg.id) : old
    );
    deleteMsg.mutate(
      { conversationId, messageId: msg.id },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(conversationId, {}) }) }
    );
  };

  const handleDeleteForMe = () => {
    setContextMenu(null);
    deleteForMe(msg.id);
  };

  const handleCopy = () => {
    if (msg.content) navigator.clipboard.writeText(msg.content).catch(() => {});
    setContextMenu(null);
  };

  // Swipe to reply
  const onTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    swipeActive.current = true;
    handlePressStart(e);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!swipeActive.current) return;
    const dx = e.touches[0].clientX - swipeStartX.current;
    const dy = Math.abs(e.touches[0].clientY - swipeStartY.current);
    if (dy > 20) { swipeActive.current = false; setSwipeX(0); return; }
    if (dx > 0 && dy < 20) {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      setSwipeX(Math.min(dx, 70));
    }
  };

  const onTouchEnd = () => {
    handlePressEnd();
    if (swipeX > 55) { onReply({ id: msg.id, content: msg.content, senderName: msg.sender.displayName || msg.sender.username }); }
    setSwipeX(0);
    swipeActive.current = false;
  };

  const hasMedia = !!msg.mediaUrl;
  const hasText = !!msg.content;
  const starred = isStarred(msg.id);

  return (
    <>
      <ForwardDialog open={forwardOpen} content={msg.content ?? ""} onClose={() => setForwardOpen(false)} />

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"} ${isGrouped ? "mt-0.5" : "mt-3"}`}
        data-testid={`message-${msg.id}`}
      >
        {!isMine && (
          <div className="w-7 flex-shrink-0">
            {isLast && (
              <Avatar className="h-7 w-7">
                <AvatarImage src={msg.sender.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xs">{(msg.sender.displayName || msg.sender.username).charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            )}
          </div>
        )}

        <div className={`max-w-[75%] sm:max-w-[65%] lg:max-w-[520px] ${isMine ? "items-end" : "items-start"} flex flex-col relative`}>
          {isEditing ? (
            <div className="flex flex-col gap-1 w-64">
              <textarea ref={editRef} className="w-full bg-muted/60 border border-primary/50 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                value={editContent} onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEditSave(); } if (e.key === "Escape") onEditCancel(); }} rows={2} />
              <div className="flex justify-end gap-1">
                <button onClick={onEditCancel} className="h-7 w-7 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"><X className="h-3.5 w-3.5" /></button>
                <button onClick={onEditSave} className="h-7 w-7 flex items-center justify-center rounded-full bg-primary hover:bg-primary/80 text-primary-foreground transition-colors"><Check className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <ReactionPicker open={pickerOpen} isMine={isMine} topEmojis={topEmojis} onSelect={handleReaction} onClose={() => setPickerOpen(false)} />
              <motion.div
                style={{ x: swipeX }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className={`flex items-end gap-1.5 ${isMine ? "flex-row-reverse" : ""}`}
                onMouseDown={handlePressStart}
                onMouseUp={handlePressEnd}
                onMouseLeave={handlePressEnd}
                onDoubleClick={handleDoubleClick}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                {swipeX > 30 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: Math.min(swipeX / 55, 1) }} className={`flex-shrink-0 ${isMine ? "mr-2" : "ml-2"}`}>
                    <Reply className="h-4 w-4 text-primary" />
                  </motion.div>
                )}
                <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                  {msg.replyTo && <ReplyQuote replyTo={msg.replyTo} isMine={isMine} />}
                  <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed cursor-pointer select-none relative break-words min-w-0 ${isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"} ${isGrouped && !isMine ? "rounded-tl-md" : ""} ${isGrouped && isMine ? "rounded-tr-md" : ""} ${msg.replyTo ? (isMine ? "rounded-tr-none" : "rounded-tl-none") : ""}`}>
                    {starred && <Star className="h-2.5 w-2.5 absolute top-1 right-1 fill-yellow-400 text-yellow-400" />}
                    {hasText && <span className="whitespace-pre-wrap break-words">{msg.content}</span>}
                    {hasMedia && <MediaDisplay url={msg.mediaUrl} type={msg.mediaType ?? ""} name={msg.content || undefined} />}
                  </div>
                </div>
              </motion.div>
              <ReactionPills reactions={msg.reactions ?? []} currentUserId={currentUser.id} onToggle={handleReaction} />
            </div>
          )}

          {isLast && !isEditing && (
            <span className={`text-[10px] text-muted-foreground/50 mt-1 px-1 flex items-center gap-1 ${isMine ? "flex-row-reverse" : ""}`}>
              {formatMessageTime(new Date(msg.createdAt))}
              {msg.editedAt && <span className="text-[9px] opacity-60 flex items-center gap-0.5"><Pencil className="h-2 w-2" />edited</span>}
              {isMine && isLastSeen && (
                <span className="flex items-center gap-0.5 text-primary/60">
                  <CheckCheck className="h-3 w-3" />Seen
                </span>
              )}
            </span>
          )}
        </div>
      </motion.div>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setContextMenu(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 8 }}
              transition={{ duration: 0.15 }}
              className="fixed z-50 bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden"
              style={{
                left: Math.max(8, Math.min(contextMenu.x - 120, window.innerWidth - 248)),
                top: Math.max(8, contextMenu.y - 300),
                width: 240,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Quick reactions */}
              <div className="flex items-center gap-1 px-3 py-2.5 border-b border-border/20">
                {["❤️", "😂", "😮", "😢", "👍", "👎"].map((emoji) => (
                  <button key={emoji} onClick={() => handleReaction(emoji)} className="text-2xl hover:scale-125 transition-transform p-0.5 h-9 w-9 flex items-center justify-center">{emoji}</button>
                ))}
                <button onClick={() => { setContextMenu(null); setPickerOpen(true); }} className="ml-auto text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/50 transition-colors flex-shrink-0">
                  <SmilePlus className="h-5 w-5" />
                </button>
              </div>

              <button className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
                onClick={() => { setContextMenu(null); onReply({ id: msg.id, content: msg.content, senderName: msg.sender.displayName || msg.sender.username }); }}>
                <Reply className="h-4 w-4 text-muted-foreground" />Reply
              </button>

              {isMine && (
                <button className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
                  onClick={() => { setContextMenu(null); onEditStart(msg.id, msg.content); }}>
                  <Pencil className="h-4 w-4 text-muted-foreground" />Edit
                </button>
              )}

              {msg.content && (
                <button className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors" onClick={handleCopy}>
                  <Copy className="h-4 w-4 text-muted-foreground" />Copy
                </button>
              )}

              <button className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
                onClick={() => { setContextMenu(null); setForwardOpen(true); }}>
                <Forward className="h-4 w-4 text-muted-foreground" />Forward
              </button>

              <button className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
                onClick={() => {
                  toggleStar(msg.id, { content: msg.content ?? "", senderName: msg.sender.displayName || msg.sender.username, createdAt: msg.createdAt });
                  setContextMenu(null);
                }}>
                <Star className={`h-4 w-4 ${starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                {starred ? "Unstar" : "Star"}
              </button>

              <div className="border-t border-border/20" />

              <button className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 text-destructive transition-colors"
                onClick={handleDeleteForMe}>
                <Trash2 className="h-4 w-4" />Delete for me
              </button>

              {isMine && (
                <button className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 text-destructive transition-colors"
                  onClick={handleDeleteForEveryone}>
                  <Trash2 className="h-4 w-4" />Delete for everyone
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default function MessageList({ conversationId, currentUser, backgroundStyle, searchQuery = "", replyTo, onReply }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const { recordUsage, getTopEmojis } = useEmojiUsage(currentUser.id);
  const topEmojis = getTopEmojis(5);
  const { isDeleted } = useDeletedMessages();

  const { data: messages = [], isLoading } = useListMessages(conversationId, {}, {
    query: { queryKey: getListMessagesQueryKey(conversationId, {}), refetchInterval: 3000, enabled: !!conversationId },
  });

  const { data: typingStatuses = [] } = useGetTypingStatus({
    query: { queryKey: getGetTypingStatusQueryKey(), refetchInterval: 2000 },
  });

  const editMessage = useEditMessage();
  const markRead = useMarkConversationRead();

  useEffect(() => {
    markRead.mutate({ id: conversationId }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() }) });
  }, [conversationId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const startEdit = (msgId: number, content: string) => { setEditingId(msgId); setEditContent(content); };
  const cancelEdit = () => { setEditingId(null); setEditContent(""); };
  const saveEdit = (msgId: number) => {
    if (!editContent.trim()) return;
    editMessage.mutate(
      { id: conversationId, messageId: msgId, data: { content: editContent.trim() } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(conversationId, {}) }); setEditingId(null); } }
    );
  };

  const typingStatus = typingStatuses.find((t) => t.conversationId === conversationId);
  const isOtherTyping = (typingStatus?.typingUserIds ?? []).filter((id) => id !== currentUser.id).length > 0;

  const filteredMessages = searchQuery
    ? messages.filter((m) => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const visibleMessages = filteredMessages.filter((m) => !isDeleted(m.id));

  const myReadMessages = visibleMessages.filter((m) => m.senderId === currentUser.id && m.isRead);
  const lastReadSentId = myReadMessages.length > 0 ? myReadMessages[myReadMessages.length - 1].id : null;

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1" style={backgroundStyle} data-testid="message-list">
      {visibleMessages.length === 0 && !searchQuery && (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
        </div>
      )}
      {visibleMessages.length === 0 && searchQuery && (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-muted-foreground">No messages match your search.</p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {visibleMessages.map((msg, i) => {
          const isMine = msg.senderId === currentUser.id;
          const prevMsg = visibleMessages[i - 1];
          const isGrouped = prevMsg?.senderId === msg.senderId;
          const isLast = !visibleMessages[i + 1] || visibleMessages[i + 1].senderId !== msg.senderId;
          const isLastSeen = isMine && msg.id === lastReadSentId;
          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isMine={isMine}
              isGrouped={isGrouped}
              isLast={isLast}
              currentUser={currentUser}
              conversationId={conversationId}
              onEditStart={startEdit}
              isEditing={editingId === msg.id}
              editContent={editContent}
              setEditContent={setEditContent}
              onEditSave={() => saveEdit(msg.id)}
              onEditCancel={cancelEdit}
              topEmojis={topEmojis}
              onRecord={recordUsage}
              onReply={onReply ?? (() => {})}
              isLastSeen={isLastSeen}
            />
          );
        })}
      </AnimatePresence>

      <AnimatePresence>
        {isOtherTyping && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }} className="flex items-end gap-2 mt-2">
            <div className="w-7" />
            <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5"><TypingDots /></div>
          </motion.div>
        )}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}
