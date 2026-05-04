import { useState } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { useGetConversation, getGetConversationQueryKey, useGetOnlineUsers, getGetOnlineUsersQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

interface ConversationHeaderProps {
  conversationId: number;
  onBack?: () => void;
  onSearch?: (query: string) => void;
}

function formatLastSeen(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return "Offline";
  const date = new Date(lastSeenAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 2) return "Last seen just now";
  if (diffMins < 60) return `Last seen ${diffMins} min ago`;
  if (isToday(date)) return `Last seen today at ${format(date, "h:mm a")}`;
  if (isYesterday(date)) return `Last seen yesterday at ${format(date, "h:mm a")}`;
  return `Last seen ${formatDistanceToNow(date, { addSuffix: true })}`;
}

export default function ConversationHeader({ conversationId, onBack, onSearch }: ConversationHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: conversation } = useGetConversation(conversationId, {
    query: { queryKey: getGetConversationQueryKey(conversationId), enabled: !!conversationId, refetchInterval: 5000 },
  });

  const { data: onlineData } = useGetOnlineUsers({
    query: { queryKey: getGetOnlineUsersQueryKey(), refetchInterval: 10000 },
  });

  const onlineUserIds = onlineData?.onlineUserIds ?? [];
  const isOnline = conversation ? onlineUserIds.includes(conversation.otherUser.id) : false;
  const lastSeenAt = (conversation?.otherUser as any)?.lastSeenAt;

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    onSearch?.(q);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    onSearch?.("");
  };

  if (!conversation) {
    return (
      <div className="h-14 border-b border-border/30 bg-card/80 backdrop-blur-sm flex items-center px-4 gap-2 flex-shrink-0">
        {onBack && (
          <button onClick={onBack} className="md:hidden mr-1 text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="h-8 w-32 bg-muted/50 rounded animate-pulse" />
      </div>
    );
  }

  const displayName = conversation.otherUser.displayName || conversation.otherUser.username;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="h-14 border-b border-border/30 bg-card/80 backdrop-blur-sm flex items-center px-3 sm:px-4 gap-2 sm:gap-3 flex-shrink-0" data-testid="conversation-header">
      {onBack && (
        <button onClick={onBack} className="md:hidden flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1.5 -ml-1.5 rounded-lg hover:bg-muted/50" aria-label="Back to conversations">
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}

      {searchOpen ? (
        <div className="flex-1 flex items-center gap-2">
          <input
            autoFocus
            className="flex-1 bg-muted/50 rounded-xl px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/50 border-0"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          <button onClick={closeSearch} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/50 flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative flex-shrink-0">
            <Avatar className="h-9 w-9">
              <AvatarImage src={conversation.otherUser.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm">{initials}</AvatarFallback>
            </Avatar>
            {isOnline && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-card" />}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{displayName}</p>
            <p className="text-xs truncate">
              {isOnline ? (
                <span className="text-green-500">Online</span>
              ) : (
                <span className="text-muted-foreground">{formatLastSeen(lastSeenAt)}</span>
              )}
            </p>
          </div>

          <button
            onClick={() => setSearchOpen(true)}
            className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Search messages"
          >
            <Search className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
