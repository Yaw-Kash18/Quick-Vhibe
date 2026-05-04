import { useState } from "react";
import { ArrowLeft, Users, Search, X, Star } from "lucide-react";
import { useGetGroup, getGetGroupQueryKey } from "@workspace/api-client-react";
import GroupInfoPanel from "./group-info-panel";
import StarredMessagesPanel from "./starred-messages-panel";

interface GroupHeaderProps {
  groupId: number;
  currentUserId: number;
  onBack?: () => void;
  onLeft?: () => void;
  onSearch?: (query: string) => void;
}

export default function GroupHeader({ groupId, currentUserId, onBack, onLeft, onSearch }: GroupHeaderProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showStarred, setShowStarred] = useState(false);

  const { data: group } = useGetGroup(groupId, {
    query: { queryKey: getGetGroupQueryKey(groupId), enabled: !!groupId, refetchInterval: 10000 },
  });

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    onSearch?.(q);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    onSearch?.("");
  };

  if (!group) {
    return (
      <div className="h-14 border-b border-border/30 bg-card/80 backdrop-blur-sm flex items-center px-3 sm:px-4 gap-2 flex-shrink-0">
        {onBack && (
          <button onClick={onBack} className="md:hidden mr-1 text-muted-foreground hover:text-foreground p-1.5 -ml-1.5 rounded-lg hover:bg-muted/50 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="h-8 w-32 bg-muted/50 rounded animate-pulse" />
      </div>
    );
  }

  const preview = group.members.slice(0, 3);

  return (
    <>
      <StarredMessagesPanel open={showStarred} onClose={() => setShowStarred(false)} />

      <div className="h-14 border-b border-border/30 bg-card/80 backdrop-blur-sm flex items-center px-3 sm:px-4 gap-2 sm:gap-3 flex-shrink-0" data-testid="group-header">
        {onBack && (
          <button onClick={onBack} className="md:hidden flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1.5 -ml-1.5 rounded-lg hover:bg-muted/50" aria-label="Back">
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
            <button className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity" onClick={() => setShowInfo(true)} aria-label="View group info">
              <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{group.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
                  {group.adminOnlyMessaging && <span className="ml-1.5 text-primary/60">· admin-only</span>}
                  {preview.length > 0 && !group.adminOnlyMessaging && (
                    <span className="ml-1">· {preview.map((m) => m.displayName || m.username).join(", ")}{group.memberCount > 3 ? " ..." : ""}</span>
                  )}
                </p>
              </div>
            </button>

            <button
              onClick={() => setShowStarred(true)}
              className={`flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-full transition-colors ${showStarred ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400 hover:bg-muted/50"}`}
              aria-label="Starred messages"
            >
              <Star className={`h-4 w-4 ${showStarred ? "fill-yellow-400" : ""}`} />
            </button>

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

      <GroupInfoPanel
        groupId={groupId}
        currentUserId={currentUserId}
        open={showInfo}
        onClose={() => setShowInfo(false)}
        onLeft={onLeft}
      />
    </>
  );
}
