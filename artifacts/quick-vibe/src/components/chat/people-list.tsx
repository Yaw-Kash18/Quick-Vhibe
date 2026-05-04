import { useState } from "react";
import { motion } from "framer-motion";
import { Users2, MessageSquarePlus, Search, X } from "lucide-react";
import {
  useListAllUsers, getListAllUsersQueryKey,
  useGetOnlineUsers, getGetOnlineUsersQueryKey,
  useCreateConversation, getListConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";

interface PeopleListProps {
  currentUserId: number;
  onSelectDM: (conversationId: number) => void;
}

export default function PeopleList({ currentUserId, onSelectDM }: PeopleListProps) {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useListAllUsers({
    query: { queryKey: getListAllUsersQueryKey(), refetchInterval: 5000 },
  });

  const { data: onlineData } = useGetOnlineUsers({
    query: { queryKey: getGetOnlineUsersQueryKey(), refetchInterval: 10000 },
  });

  const createConversation = useCreateConversation();
  const onlineUserIds = onlineData?.onlineUserIds ?? [];

  const filtered = users.filter((u) => {
    const name = (u.displayName || u.username).toLowerCase();
    const handle = u.username.toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || handle.includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    const aOnline = onlineUserIds.includes(a.id) ? 1 : 0;
    const bOnline = onlineUserIds.includes(b.id) ? 1 : 0;
    if (aOnline !== bOnline) return bOnline - aOnline;
    return (a.displayName || a.username).localeCompare(b.displayName || b.username);
  });

  const handleMessage = (userId: number) => {
    createConversation.mutate(
      { data: { targetUserId: userId } },
      {
        onSuccess: (conv) => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          onSelectDM(conv.id);
        },
      }
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2.5 border-b border-border/30 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search people..."
            className="pl-9 h-9 bg-muted/50 border-0 text-sm focus-visible:ring-1 focus-visible:ring-primary/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Count */}
      <div className="px-4 py-2 flex-shrink-0">
        <p className="text-xs text-muted-foreground font-medium">
          {isLoading ? "Loading..." : `${sorted.length} ${sorted.length === 1 ? "person" : "people"}${search ? " found" : " registered"}`}
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-0.5 px-3 py-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-3 rounded-xl">
                <div className="h-11 w-11 rounded-full bg-muted/50 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-28 bg-muted/50 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-muted/30 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Users2 className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {search ? "No people match your search" : "No other users yet"}
            </p>
            {!search && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Invite others to join Quick Vibe
              </p>
            )}
          </div>
        ) : (
          sorted.map((user, i) => {
            const isOnline = onlineUserIds.includes(user.id);
            const displayName = user.displayName || user.username;
            const initials = displayName.charAt(0).toUpperCase();
            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: Math.min(i * 0.03, 0.3) }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-card ${
                      isOnline ? "bg-green-500" : "bg-muted-foreground/30"
                    }`}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    {isOnline && (
                      <span className="text-[10px] text-green-500 font-medium flex-shrink-0">Online</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                    {!isOnline && (
                      <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">
                        · joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Message button — always visible */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleMessage(user.id)}
                  disabled={createConversation.isPending}
                  className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                  title={`Message ${displayName}`}
                >
                  <MessageSquarePlus className="h-4 w-4" />
                </motion.button>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
