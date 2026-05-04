import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Users, Plus, Minus } from "lucide-react";
import { useCreateGroup, getListGroupsQueryKey, useSearchUsers, getSearchUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface User {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (groupId: number) => void;
}

export default function CreateGroupDialog({ open, onClose, onCreated }: CreateGroupDialogProps) {
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const queryClient = useQueryClient();

  const { data: searchResults = [], isLoading: isSearching } = useSearchUsers(
    { q: searchQuery },
    {
      query: {
        enabled: searchQuery.length >= 2,
        queryKey: getSearchUsersQueryKey({ q: searchQuery }),
      },
    }
  );

  const createGroup = useCreateGroup();

  const getDisplayName = (u: User) => u.displayName || u.username;
  const getInitials = (u: User) => getDisplayName(u).charAt(0).toUpperCase();

  const toggleUser = (user: User) => {
    setSelectedUsers((prev) =>
      prev.find((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleCreate = () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    createGroup.mutate(
      {
        data: {
          name: groupName.trim(),
          memberUserIds: selectedUsers.map((u) => u.id),
        },
      },
      {
        onSuccess: (group) => {
          queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
          onCreated(group.id);
          onClose();
          setGroupName("");
          setSelectedUsers([]);
          setSearchQuery("");
        },
      }
    );
  };

  const handleClose = () => {
    onClose();
    setGroupName("");
    setSelectedUsers([]);
    setSearchQuery("");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full sm:max-w-md bg-card border border-border/50 sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/30 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <h2 className="text-base font-semibold">New Group</h2>
                </div>
                <button
                  onClick={handleClose}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Group name */}
                <div className="px-5 py-4 border-b border-border/20">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                    Group Name
                  </label>
                  <Input
                    placeholder="e.g. Weekend Plans"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50"
                    data-testid="input-group-name"
                    autoFocus
                  />
                </div>

                {/* Selected members */}
                {selectedUsers.length > 0 && (
                  <div className="px-5 py-3 border-b border-border/20">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2.5">
                      Members ({selectedUsers.length})
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedUsers.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full pl-2 pr-1 py-1 text-xs"
                        >
                          <span>{getDisplayName(u)}</span>
                          <button
                            onClick={() => toggleUser(u)}
                            className="h-4 w-4 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center transition-colors"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search users */}
                <div className="px-5 py-3">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                    Add Members
                  </label>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search by username..."
                      className="pl-9 h-9 bg-muted/50 border-0 text-sm focus-visible:ring-1 focus-visible:ring-primary/50"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search-members"
                    />
                  </div>

                  {searchQuery.length < 2 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Type at least 2 characters to search
                    </p>
                  ) : isSearching ? (
                    <p className="text-xs text-muted-foreground text-center py-3">Searching...</p>
                  ) : searchResults.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">No users found</p>
                  ) : (
                    <div className="space-y-0.5">
                      {searchResults.map((user) => {
                        const isSelected = selectedUsers.some((u) => u.id === user.id);
                        return (
                          <button
                            key={user.id}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                              isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                            }`}
                            onClick={() => toggleUser(user)}
                            data-testid={`button-toggle-member-${user.id}`}
                          >
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarImage src={user.avatarUrl ?? undefined} />
                              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                {getInitials(user)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left min-w-0">
                              <p className="text-sm font-medium truncate">{getDisplayName(user)}</p>
                              <p className="text-xs text-muted-foreground">@{user.username}</p>
                            </div>
                            <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isSelected ? "bg-primary text-primary-foreground" : "border border-border"
                            }`}>
                              {isSelected ? (
                                <Minus className="h-3 w-3" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-border/30 flex-shrink-0">
                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={!groupName.trim() || selectedUsers.length === 0 || createGroup.isPending}
                  data-testid="button-create-group"
                >
                  {createGroup.isPending
                    ? "Creating..."
                    : `Create Group${selectedUsers.length > 0 ? ` with ${selectedUsers.length + 1} people` : ""}`}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
