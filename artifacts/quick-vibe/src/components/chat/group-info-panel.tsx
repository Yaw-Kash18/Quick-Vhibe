import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, UserMinus, Users, UserPlus, Search, Loader2, Pencil, Check, ToggleLeft, ToggleRight } from "lucide-react";
import {
  useGetGroup, getGetGroupQueryKey, useUpdateGroupMember, useRemoveGroupMember,
  useSearchUsers, getSearchUsersQueryKey, useGetOnlineUsers, getGetOnlineUsersQueryKey,
  useAddGroupMember, useUpdateGroup,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface GroupInfoPanelProps {
  groupId: number;
  currentUserId: number;
  open: boolean;
  onClose: () => void;
  onLeft?: () => void;
}

export default function GroupInfoPanel({ groupId, currentUserId, open, onClose, onLeft }: GroupInfoPanelProps) {
  const queryClient = useQueryClient();
  const [showAddMember, setShowAddMember] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [descValue, setDescValue] = useState("");

  const { data: group, isLoading } = useGetGroup(groupId, {
    query: { queryKey: getGetGroupQueryKey(groupId), enabled: open && !!groupId, refetchInterval: 5000 },
  });

  const { data: onlineData } = useGetOnlineUsers({
    query: { queryKey: getGetOnlineUsersQueryKey(), refetchInterval: 10000 },
  });

  const { data: searchResults = [], isLoading: isSearchLoading } = useSearchUsers(
    { q: addSearch },
    { query: { enabled: addSearch.length >= 2, queryKey: getSearchUsersQueryKey({ q: addSearch }) } }
  );

  const updateMember = useUpdateGroupMember();
  const removeMember = useRemoveGroupMember();
  const addMember = useAddGroupMember();
  const updateGroup = useUpdateGroup();

  const onlineUserIds = onlineData?.onlineUserIds ?? [];
  const currentMember = group?.members.find((m) => m.id === currentUserId);
  const isAdmin = currentMember?.isAdmin ?? false;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(groupId) });
  };

  const handleToggleAdmin = (userId: number, current: boolean) => {
    updateMember.mutate({ id: groupId, userId, data: { isAdmin: !current } }, { onSuccess: invalidate });
  };

  const handleRemove = (userId: number) => {
    const confirmMsg = userId === currentUserId ? "Leave this group?" : "Remove this member?";
    if (!confirm(confirmMsg)) return;
    removeMember.mutate({ id: groupId, userId }, {
      onSuccess: () => {
        invalidate();
        if (userId === currentUserId) { onClose(); onLeft?.(); }
      },
    });
  };

  const handleAddMember = (userId: number) => {
    addMember.mutate({ groupId, userId }, {
      onSuccess: () => { invalidate(); setAddSearch(""); setShowAddMember(false); },
    });
  };

  const handleSaveName = () => {
    const trimmed = nameValue.trim();
    if (!trimmed) return;
    updateGroup.mutate({ id: groupId, data: { name: trimmed } as any }, {
      onSuccess: () => { invalidate(); setEditingName(false); },
    });
  };

  const handleSaveDesc = () => {
    updateGroup.mutate({ id: groupId, data: { description: descValue.trim() } as any }, {
      onSuccess: () => { invalidate(); setEditingDesc(false); },
    });
  };

  const handleToggleAdminOnly = () => {
    if (!group) return;
    updateGroup.mutate({ id: groupId, data: { adminOnlyMessaging: !group.adminOnlyMessaging } as any }, {
      onSuccess: invalidate,
    });
  };

  const existingMemberIds = new Set(group?.members.map((m) => m.id) ?? []);
  const filteredSearch = searchResults.filter((u) => !existingMemberIds.has(u.id));

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
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-full max-w-sm z-50 bg-card border-l border-border/30 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border/30 flex-shrink-0">
              <h2 className="text-base font-semibold">Group Info</h2>
              <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !group ? null : (
              <div className="flex-1 overflow-y-auto">
                {/* Group icon + name + description */}
                <div className="flex flex-col items-center py-6 px-4 border-b border-border/20">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Users className="h-8 w-8 text-primary" />
                  </div>

                  {/* Name editing */}
                  {isAdmin && editingName ? (
                    <div className="flex items-center gap-2 w-full max-w-[220px] mb-1">
                      <input
                        autoFocus
                        className="flex-1 bg-muted/50 rounded-xl px-3 py-1.5 text-sm font-semibold text-center outline-none focus:ring-1 focus:ring-primary/50"
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                      />
                      <button onClick={handleSaveName} className="h-7 w-7 flex items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditingName(false)} className="h-7 w-7 flex items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mb-1">
                      <h3 className="text-lg font-semibold">{group.name}</h3>
                      {isAdmin && (
                        <button onClick={() => { setNameValue(group.name); setEditingName(true); }} className="h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Description editing */}
                  {isAdmin && editingDesc ? (
                    <div className="flex flex-col items-center gap-2 w-full max-w-[240px]">
                      <textarea
                        autoFocus
                        className="w-full bg-muted/50 rounded-xl px-3 py-1.5 text-xs text-center text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                        value={descValue}
                        onChange={(e) => setDescValue(e.target.value)}
                        rows={2}
                        placeholder="Add a description..."
                        onKeyDown={(e) => { if (e.key === "Escape") setEditingDesc(false); }}
                      />
                      <div className="flex gap-2">
                        <button onClick={handleSaveDesc} className="h-7 px-3 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs gap-1">
                          <Check className="h-3 w-3" />Save
                        </button>
                        <button onClick={() => setEditingDesc(false)} className="h-7 px-3 flex items-center justify-center rounded-full bg-muted text-muted-foreground text-xs">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {group.description ? (
                        <p className="text-sm text-muted-foreground text-center">{group.description}</p>
                      ) : isAdmin ? (
                        <p className="text-xs text-muted-foreground/50 italic">No description</p>
                      ) : null}
                      {isAdmin && (
                        <button onClick={() => { setDescValue(group.description ?? ""); setEditingDesc(true); }} className="h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0">
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">{group.memberCount} member{group.memberCount !== 1 ? "s" : ""}</Badge>
                    {group.adminOnlyMessaging && <Badge variant="outline" className="text-xs text-primary">Admin-only messaging</Badge>}
                  </div>
                </div>

                {/* Admin-only messaging toggle (admin only) */}
                {isAdmin && (
                  <div className="px-4 py-3 border-b border-border/20">
                    <button
                      onClick={handleToggleAdminOnly}
                      className="w-full flex items-center justify-between py-1 group"
                      disabled={updateGroup.isPending}
                    >
                      <div>
                        <p className="text-sm font-medium text-left">Admin-only messaging</p>
                        <p className="text-xs text-muted-foreground text-left mt-0.5">Only admins can send messages</p>
                      </div>
                      <div className={`transition-colors ${group.adminOnlyMessaging ? "text-primary" : "text-muted-foreground"}`}>
                        {group.adminOnlyMessaging
                          ? <ToggleRight className="h-6 w-6" />
                          : <ToggleLeft className="h-6 w-6" />
                        }
                      </div>
                    </button>
                  </div>
                )}

                {/* Add member */}
                <div className="px-4 py-3 border-b border-border/20">
                  {!showAddMember ? (
                    <button onClick={() => setShowAddMember(true)} className="w-full flex items-center gap-3 py-2 text-sm text-primary hover:opacity-80 transition-opacity">
                      <div className="h-9 w-9 rounded-full border-2 border-dashed border-primary/40 flex items-center justify-center flex-shrink-0">
                        <UserPlus className="h-4 w-4" />
                      </div>
                      <span>Add member</span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <input
                            autoFocus
                            className="w-full bg-muted/50 rounded-xl pl-8 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 border-0"
                            placeholder="Search users..."
                            value={addSearch}
                            onChange={(e) => setAddSearch(e.target.value)}
                          />
                        </div>
                        <button onClick={() => { setShowAddMember(false); setAddSearch(""); }} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/50">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {addSearch.length >= 2 && (
                        <div className="rounded-xl bg-muted/30 overflow-hidden">
                          {isSearchLoading ? (
                            <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                          ) : filteredSearch.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No users found</p>
                          ) : (
                            filteredSearch.slice(0, 5).map((user) => (
                              <button key={user.id} onClick={() => handleAddMember(user.id)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={user.avatarUrl ?? undefined} />
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs">{(user.displayName || user.username).charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{user.displayName || user.username}</p>
                                  <p className="text-xs text-muted-foreground">@{user.username}</p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Members list */}
                <div className="px-4 py-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2">Members</p>
                  {group.members.map((member) => {
                    const isOnline = onlineUserIds.includes(member.id);
                    const isMe = member.id === currentUserId;
                    const displayName = member.displayName || member.username;
                    return (
                      <div key={member.id} className="flex items-center gap-3 py-3 border-b border-border/10 last:border-0">
                        <div className="relative flex-shrink-0">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.avatarUrl ?? undefined} />
                            <AvatarFallback className="bg-muted text-muted-foreground text-sm">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-card ${isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">{displayName}{isMe ? " (you)" : ""}</span>
                            {member.isAdmin && <Shield className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                          </div>
                          <p className="text-xs">
                            {isOnline ? <span className="text-green-500">Online</span> : <span className="text-muted-foreground">Offline</span>}
                          </p>
                        </div>

                        {isAdmin && !isMe && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleToggleAdmin(member.id, member.isAdmin)}
                              className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors ${member.isAdmin ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
                              title={member.isAdmin ? "Remove admin" : "Make admin"}
                            >
                              <Shield className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleRemove(member.id)}
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Remove member"
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Leave group */}
                <div className="px-4 py-4">
                  <Button variant="destructive" size="sm" className="w-full" onClick={() => handleRemove(currentUserId)}>
                    Leave Group
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
