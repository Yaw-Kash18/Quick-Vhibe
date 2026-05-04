import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Smile, Paperclip, Lock, X, FileIcon, Reply } from "lucide-react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import {
  useSendMessage, getListMessagesQueryKey, getListConversationsQueryKey,
  useSendTypingIndicator, useSendGroupMessage, getListGroupMessagesQueryKey, getListGroupsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";

interface ReplyTo { id: number; content: string; senderName: string; }

interface MessageInputProps {
  chatType: "dm" | "group";
  chatId: number;
  readOnly?: boolean;
  readOnlyReason?: string;
  replyTo?: ReplyTo | null;
  onCancelReply?: () => void;
}

function resizeImage(file: File, maxPx = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MessageInput({ chatType, chatId, readOnly, readOnlyReason, replyTo, onCancelReply }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ url: string; type: string; name: string } | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const sendMessage = useSendMessage();
  const sendGroupMessage = useSendGroupMessage();
  const sendTyping = useSendTypingIndicator();

  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (chatType === "dm") sendTyping.mutate({ id: chatId, data: { isTyping } });
  }, [chatId, chatType]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (chatType === "dm") {
      if (!isTypingRef.current) { isTypingRef.current = true; sendTypingIndicator(true); }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => { isTypingRef.current = false; sendTypingIndicator(false); }, 2000);
    }
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    const textarea = textareaRef.current;
    if (!textarea) { setContent((c) => c + emoji.native); return; }
    const start = textarea.selectionStart ?? content.length;
    const end = textarea.selectionEnd ?? content.length;
    const newContent = content.slice(0, start) + emoji.native + content.slice(end);
    setContent(newContent);
    requestAnimationFrame(() => { textarea.focus(); const pos = start + emoji.native.length; textarea.setSelectionRange(pos, pos); });
    setShowEmojiPicker(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingFile(true);
    try {
      let url: string;
      let type: string;
      if (file.type.startsWith("image/")) {
        url = await resizeImage(file);
        type = "image/jpeg";
      } else {
        url = await fileToDataUrl(file);
        type = file.type || "application/octet-stream";
      }
      setPendingMedia({ url, type, name: file.name });
    } catch { } finally {
      setIsProcessingFile(false);
      e.target.value = "";
    }
  };

  const handleSend = () => {
    const trimmed = content.trim();
    const hasMedia = !!pendingMedia;
    if (!trimmed && !hasMedia) return;

    const msgContent = trimmed || (pendingMedia?.type.startsWith("image/") ? "" : (pendingMedia?.name ?? ""));
    const mediaUrl = pendingMedia?.url ?? null;
    const mediaType = pendingMedia?.type ?? null;
    const replyToId = replyTo?.id ?? null;

    if (chatType === "dm") {
      if (sendMessage.isPending) return;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      isTypingRef.current = false;
      sendTypingIndicator(false);
      setContent(""); setPendingMedia(null); onCancelReply?.();
      sendMessage.mutate(
        { id: chatId, data: { content: msgContent, mediaUrl, mediaType, ...(replyToId && { replyToId }) } as any },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(chatId, {}) }); queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() }); } }
      );
    } else {
      if (sendGroupMessage.isPending) return;
      setContent(""); setPendingMedia(null); onCancelReply?.();
      sendGroupMessage.mutate(
        { id: chatId, data: { content: msgContent, mediaUrl, mediaType, ...(replyToId && { replyToId }) } as any },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListGroupMessagesQueryKey(chatId, {}) }); queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() }); } }
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === "Escape" && showEmojiPicker) setShowEmojiPicker(false);
  };

  if (readOnly) {
    return (
      <div className="px-3 sm:px-4 py-3 border-t border-border/30 bg-card/50 flex-shrink-0">
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span>{readOnlyReason ?? "Messaging is restricted"}</span>
        </div>
      </div>
    );
  }

  const isPending = chatType === "dm" ? sendMessage.isPending : sendGroupMessage.isPending;
  const canSend = (content.trim().length > 0 || !!pendingMedia) && !isPending;

  return (
    <div className="px-3 sm:px-4 py-3 sm:py-4 border-t border-border/30 bg-card/50 flex-shrink-0 relative">
      {/* Emoji Picker */}
      <AnimatePresence>
        {showEmojiPicker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
            <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }} transition={{ duration: 0.15 }} className="absolute bottom-20 left-3 sm:left-4 z-50">
              <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="dark" previewPosition="none" skinTonePosition="none" maxFrequentRows={2} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Reply preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="mb-2 flex items-center gap-2 bg-primary/10 rounded-xl p-2 pl-3 border-l-2 border-primary">
            <Reply className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary truncate">{replyTo.senderName}</p>
              <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
            </div>
            <button onClick={onCancelReply} className="text-muted-foreground hover:text-foreground flex-shrink-0 p-1">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending media preview */}
      <AnimatePresence>
        {pendingMedia && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="mb-2 flex items-center gap-2 bg-muted/40 rounded-xl p-2 pr-3">
            {pendingMedia.type.startsWith("image/") ? (
              <img src={pendingMedia.url} className="h-12 w-12 rounded-lg object-cover flex-shrink-0" alt="preview" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileIcon className="h-5 w-5 text-primary" />
              </div>
            )}
            <span className="text-xs text-muted-foreground truncate flex-1">{pendingMedia.name}</span>
            <button onClick={() => setPendingMedia(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2">
        <button type="button" className="flex-shrink-0 h-11 w-11 flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => setShowEmojiPicker((v) => !v)} aria-label="Pick emoji">
          <Smile className="h-5 w-5" />
        </button>

        <button type="button" className="flex-shrink-0 h-11 w-11 flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" onClick={() => fileInputRef.current?.click()} disabled={isProcessingFile} aria-label="Attach file">
          {isProcessingFile ? <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Paperclip className="h-5 w-5" />}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt,.zip,.mp4,.mp3" className="hidden" onChange={handleFileSelect} />

        <Textarea
          ref={textareaRef}
          placeholder="Message..."
          className="flex-1 resize-none min-h-[44px] max-h-32 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 text-sm rounded-2xl px-4 py-3 leading-relaxed overflow-y-auto"
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
          data-testid="input-message"
        />

        <motion.button
          type="button"
          className={`h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-full transition-colors ${canSend ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-muted text-muted-foreground cursor-not-allowed"}`}
          onClick={handleSend}
          disabled={!canSend}
          whileHover={canSend ? { scale: 1.05 } : {}}
          whileTap={canSend ? { scale: 0.95 } : {}}
          data-testid="button-send-message"
        >
          <Send className="h-4 w-4" />
        </motion.button>
      </div>
    </div>
  );
}
