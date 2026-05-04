import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Settings, MessageSquare, X, Users, Pin, Trash2, LogOut, Star, Users2 } from "lucide-react";
import { useAuth } from "@/App";
import {
  useListConversations, getListConversationsQueryKey,
  useCreateConversation,
  useSearchUsers, getSearchUsersQueryKey,
  useGetUnreadCounts, getGetUnreadCountsQueryKey,
  useGetOnlineUsers, getGetOnlineUsersQueryKey,
  useListGroups, getListGroupsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import CreateGroupDialog from "./create-group-dialog";
import StarredMessagesPanel from "./starred-messages-panel";
import PeopleList from "./people-list";
import { usePinnedChats } from "@/hooks/use-pinned-chats";

interface User {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface ActiveChat {
  type: "dm" | "group";
  id: number;
}

interface SidebarProps {
  currentUser: User;
  activeChat: ActiveChat | null;
  onSelectDM: (id: number) => void;
  onSelectGroup: (id: number) => void;
}

type ChatItem =
  | { kind: "dm"; id: number; name: string; avatarUrl: string | null; subtitle: string; unread: number; isOnline: boolean; updatedAt: Date; senderId?: number }
  | { kind: "group"; id: number; name: string; subtitle: string; memberCount: number; updatedAt: Date };

interface ContextMenu {
  item: ChatItem;
  x: number;
  y: number;
}

export default function Sidebar({ currentUser, activeChat, onSelectDM, onSelectGroup }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [showStarred, setShowStarred] = useState(false);
  const [activeTab, setActiveTab] = useState<"chats" | "people">("chats");
  const queryClient = useQueryClient();
  const { toggle: togglePin, isPinned } = usePinnedChats();
  const { signOut } = useAuth();

  const { data: conversations = [], isLoading: isLoadingConvos } = useListConversations({
    query: { queryKey: getListConversationsQueryKey(), refetchInterval: 3000 },
  });
  const { data: groups = [], isLoading: isLoadingGroups } = useListGroups({
    query: { queryKey: getListGroupsQueryKey(), refetchInterval: 3000 },
  });
  const { data: unreadCounts = [] } = useGetUnreadCounts({
    query: { queryKey: getGetUnreadCountsQueryKey(), refetchInterval: 3000 },
  });
  const { data: onlineData } = useGetOnlineUsers({
    query: { queryKey: getGetOnlineUsersQueryKey(), refetchInterval: 10000 },
  });
  const { data: searchResults = [], isLoading: isSearchLoading } = useSearchUsers(
    { q: searchQuery },
    { query: { enabled: isSearchingUsers && searchQuery.length >= 2, queryKey: getSearchUsersQueryKey({ q: searchQuery }) } }
  );
  const createConversation = useCreateConversation();

  const onlineUserIds = onlineData?.onlineUserIds ?? [];
  const unreadMap = new Map(unreadCounts.map((u) => [u.conversationId, u.count]));
  const getDisplayName = (u: { username: string; displayName: string | null }) => u.displayName || u.username;
  const getInitials = (u: { username: string; displayName: string | null }) => getDisplayName(u).charAt(0).toUpperCase();

  const handleStartDM = (userId: number) => {
    createConversation.mutate(
      { data: { targetUserId: userId } },
      {
        onSuccess: (conv) => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          onSelectDM(conv.id);
          setSearchQuery(""); setIsSearchingUsers(false);
        },
      }
    );
  };

  const dmItems: ChatItem[] = conversations
    .filter((c) => !searchQuery || getDisplayName(c.otherUser).toLowerCase().includes(searchQuery.toLowerCase()))
    .map((c) => ({
      kind: "dm" as const,
      id: c.id,
      name: getDisplayName(c.otherUser),
      avatarUrl: c.otherUser.avatarUrl,
      subtitle: c.lastMessage
        ? (c.lastMessage.senderId === currentUser.id ? "You: " : "") + c.lastMessage.content
        : "Start a conversation",
      unread: unreadMap.get(c.id) ?? 0,
      isOnline: onlineUserIds.includes(c.otherUser.id),
      updatedAt: c.lastMessage ? new Date(c.lastMessage.createdAt) : new Date(c.createdAt),
      senderId: c.lastMessage?.senderId,
    }));

  const groupItems: ChatItem[] = groups
    .filter((g) => !searchQuery || g.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .map((g) => ({
      kind: "group" as const,
      id: g.id,
      name: g.name,
      subtitle: g.lastMessage ? `${g.lastMessage.senderName}: ${g.lastMessage.content}` : "No messages yet",
      memberCount: g.memberCount,
      updatedAt: g.lastMessage ? new Date(g.lastMessage.createdAt) : new Date(g.createdAt),
    }));

  const allItems = [...dmItems, ...groupItems].sort((a, b) => {
    const aPin = isPinned(a.kind, a.id) ? 1 : 0;
    const bPin = isPinned(b.kind, b.id) ? 1 : 0;
    if (aPin !== bPin) return bPin - aPin;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
  const isLoading = isLoadingConvos || isLoadingGroups;

  const longPressTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleLongPressStart = useCallback((item: ChatItem, e: React.TouchEvent | React.MouseEvent) => {
    const key = `${item.kind}-${item.id}`;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    longPressTimers.current.set(key, setTimeout(() => {
      setContextMenu({ item, x: rect.left + rect.width / 2, y: rect.bottom });
    }, 500));
  }, []);

  const handleLongPressEnd = useCallback((item: ChatItem) => {
    const key = `${item.kind}-${item.id}`;
    const t = longPressTimers.current.get(key);
    if (t) { clearTimeout(t); longPressTimers.current.delete(key); }
  }, []);

  const handleTap = useCallback((item: ChatItem) => {
    if (contextMenu) { setContextMenu(null); return; }
    if (item.kind === "dm") onSelectDM(item.id);
    else onSelectGroup(item.id);
  }, [contextMenu, onSelectDM, onSelectGroup]);

  return (
    <div className="flex flex-col h-full w-full" data-testid="sidebar" onClick={() => contextMenu && setContextMenu(null)}>
      <StarredMessagesPanel open={showStarred} onClose={() => setShowStarred(false)} />

      <CreateGroupDialog
        open={showGroupDialog}
        onClose={() => setShowGroupDialog(false)}
        onCreated={(id) => { onSelectGroup(id); queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() }); }}
      />

      {/* Context menu overlay */}
      <AnimatePresence>
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -4 }}
              transition={{ duration: 0.12 }}
              className="fixed z-50 bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden min-w-[160px]"
              style={{ left: Math.min(contextMenu.x - 80, window.innerWidth - 180), top: Math.min(contextMenu.y, window.innerHeight - 120) }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
                onClick={() => { togglePin(contextMenu.item.kind, contextMenu.item.id); setContextMenu(null); }}
              >
                <Pin className="h-4 w-4 text-primary" />
                {isPinned(contextMenu.item.kind, contextMenu.item.id) ? "Unpin" : "Pin"}
              </button>
              <div className="border-t border-border/20" />
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 text-destructive transition-colors"
                onClick={() => { setContextMenu(null); }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/30 flex-shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">Quick Vibe</h1>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => setIsSearchingUsers(!isSearchingUsers)} data-testid="button-new-dm">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => setShowGroupDialog(true)} data-testid="button-new-group">
            <Users className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" asChild>
            <Link href="/settings"><Settings className="h-4 w-4" /></Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => signOut()}
            title="Sign out"
            data-testid="button-sign-out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 pt-2.5 pb-0 border-b border-border/30 flex-shrink-0">
        <div className="flex items-center gap-1 mb-0">
          <button
            onClick={() => setActiveTab("chats")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === "chats"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chats
          </button>
          <button
            onClick={() => { setActiveTab("people"); setIsSearchingUsers(false); setSearchQuery(""); }}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === "people"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users2 className="h-3.5 w-3.5" />
            People
          </button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 flex-shrink-0 mb-1 transition-colors ${showStarred ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`}
            onClick={() => setShowStarred(true)}
            title="Starred messages"
          >
            <Star className={`h-3.5 w-3.5 ${showStarred ? "fill-yellow-400" : ""}`} />
          </Button>
        </div>
      </div>

      {/* People tab */}
      {activeTab === "people" && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <PeopleList
            currentUserId={currentUser.id}
            onSelectDM={(convId) => { onSelectDM(convId); setActiveTab("chats"); }}
          />
        </div>
      )}

      {/* Chats tab — search + list */}
      {activeTab === "chats" && <>
      {/* Search */}
      <div className="px-3 py-2.5 border-b border-border/30 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={isSearchingUsers ? "Find people..." : "Search..."}
            className="pl-9 h-9 bg-muted/50 border-0 text-sm focus-visible:ring-1 focus-visible:ring-primary/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchingUsers(true)}
            data-testid="input-search"
          />
          {(searchQuery || isSearchingUsers) && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => { setSearchQuery(""); setIsSearchingUsers(false); }}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {isSearchingUsers ? (
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
              {searchQuery.length < 2 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Type at least 2 characters to search</div>
              ) : isSearchLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No users found</div>
              ) : (
                searchResults.map((user) => (
                  <button key={user.id} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors"
                    onClick={() => handleStartDM(user.id)} data-testid={`button-start-dm-${user.id}`}>
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatarUrl ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">{getInitials(user)}</AvatarFallback>
                      </Avatar>
                      {onlineUserIds.includes(user.id) && (
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-card" />
                      )}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium truncate">{getDisplayName(user)}</p>
                      <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                    </div>
                  </button>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
              {isLoading ? (
                <div className="space-y-0.5 p-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-lg">
                      <div className="h-11 w-11 rounded-full bg-muted/50 animate-pulse flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-24 bg-muted/50 rounded animate-pulse" />
                        <div className="h-3 w-36 bg-muted/30 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : allItems.length === 0 ? (
                <div className="p-10 text-center">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No conversations yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Tap + to message someone or create a group</p>
                </div>
              ) : (
                allItems.map((item) => {
                  const isActive = activeChat?.type === item.kind && activeChat.id === item.id;
                  const pinned = isPinned(item.kind, item.id);
                  return (
                    <motion.button
                      key={`${item.kind}-${item.id}`}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left select-none ${isActive ? "bg-primary/10" : "hover:bg-muted/40 active:bg-muted/60"}`}
                      onClick={() => handleTap(item)}
                      onMouseDown={(e) => handleLongPressStart(item, e)}
                      onMouseUp={() => handleLongPressEnd(item)}
                      onMouseLeave={() => handleLongPressEnd(item)}
                      onTouchStart={(e) => handleLongPressStart(item, e)}
                      onTouchEnd={() => handleLongPressEnd(item)}
                      whileTap={{ scale: 0.99 }}
                      data-testid={`button-${item.kind}-${item.id}`}
                    >
                      <div className="relative flex-shrink-0">
                        {item.kind === "dm" ? (
                          <>
                            <Avatar className="h-11 w-11">
                              <AvatarImage src={(item as any).avatarUrl ?? undefined} />
                              <AvatarFallback className={`text-sm ${isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                                {item.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {(item as any).isOnline && (
                              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-card" />
                            )}
                          </>
                        ) : (
                          <div className={`h-11 w-11 rounded-full flex items-center justify-center ${isActive ? "bg-primary/20" : "bg-muted"}`}>
                            <Users className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {pinned && <Pin className="h-2.5 w-2.5 text-primary flex-shrink-0" />}
                            <span className={`text-sm font-medium truncate ${(item as any).unread > 0 ? "text-foreground" : "text-foreground/80"}`}>
                              {item.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {formatDistanceToNow(item.updatedAt, { addSuffix: false })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className={`text-xs truncate ${(item as any).unread > 0 ? "text-foreground/80 font-medium" : "text-muted-foreground"}`}>
                            {item.subtitle}
                          </p>
                          {item.kind === "group" && (
                            <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">{(item as any).memberCount} members</span>
                          )}
                          {item.kind === "dm" && (item as any).unread > 0 && (
                            <Badge className="h-4 min-w-[1rem] px-1 text-[10px] bg-primary text-primary-foreground rounded-full flex-shrink-0">
                              {(item as any).unread > 99 ? "99+" : (item as any).unread}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </>}
    </div>
  );
}
