import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, ShieldOff, UserMinus, Crown } from "lucide-react";
import {
  useGetGroup, getGetGroupQueryKey,
  useRemoveGroupMember, useUpdateGroupMember,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface GroupMembersPanelProps {
  groupId: number;
  currentUserId: number;
  open: boolean;
  onClose: () => void;
  onLeft?: () => void;
}

export default function GroupMembersPanel({ groupId, currentUserId, open, onClose, onLeft }: GroupMembersPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const { data: group, isLoading } = useGetGroup(groupId, {
    query: { queryKey: getGetGroupQueryKey(groupId), enabled: open && !!groupId, refetchInterval: 5000 },
  });

  const removeMember = useRemoveGroupMember();
  const updateMember = useUpdateGroupMember();

  const currentMember = group?.members.find((m) => m.id === currentUserId);
  const isCurrentAdmin = currentMember?.isAdmin ?? false;

  const getDisplayName = (m: { username: string; displayName: string | null }) => m.displayName || m.username;
  const getInitials = (m: { username: string; displayName: string | null }) => getDisplayName(m).charAt(0).toUpperCase();

  const handleRemove = (userId: number, isSelf: boolean) => {
    const key = `remove-${userId}`;
    setPendingAction(key);
    removeMember.mutate(
      { id: groupId, userId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(groupId) });
          toast({ title: isSelf ? "You left the group" : "Member removed" });
          if (isSelf) { onClose(); onLeft?.(); }
        },
        onError: () => toast({ title: "Error", description: "Could not remove member.", variant: "destructive" }),
        onSettled: () => setPendingAction(null),
      }
    );
  };

  const handleToggleAdmin = (userId: number, makeAdmin: boolean) => {
    const key = `admin-${userId}`;
    setPendingAction(key);
    updateMember.mutate(
      { id: groupId, userId, data: { isAdmin: makeAdmin } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(groupId) });
          toast({ title: makeAdmin ? "Made admin" : "Admin removed" });
        },
        onError: () => toast({ title: "Error", description: "Could not update role.", variant: "destructive" }),
        onSettled: () => setPendingAction(null),
      }
    );
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
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="pointer-events-auto w-full sm:max-w-sm bg-card border border-border/50 sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[80dvh]"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/30 flex-shrink-0">
                <div>
                  <h2 className="text-base font-semibold">{group?.name ?? "Members"}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{group?.memberCount ?? "…"} members</p>
                </div>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Member list */}
              <div className="flex-1 overflow-y-auto py-2">
                {isLoading ? (
                  <div className="space-y-1 px-4 py-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 py-2.5">
                        <div className="h-9 w-9 rounded-full bg-muted/50 animate-pulse flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 w-28 bg-muted/50 rounded animate-pulse" />
                          <div className="h-2.5 w-20 bg-muted/30 rounded animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  group?.members.map((member) => {
                    const isSelf = member.id === currentUserId;
                    const isCreator = member.id === group.createdById;
                    const isPending = pendingAction?.includes(String(member.id));

                    return (
                      <div key={member.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">{getInitials(member)}</AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">{getDisplayName(member)}{isSelf ? " (you)" : ""}</p>
                            {isCreator && <Crown className="h-3 w-3 text-yellow-500 flex-shrink-0" />}
                            {member.isAdmin && !isCreator && <Shield className="h-3 w-3 text-primary flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground">@{member.username}</p>
                        </div>

                        {/* Actions — only visible to admins, for non-creator targets; always allow self-leave */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isCurrentAdmin && !isSelf && !isCreator && (
                            <>
                              {member.isAdmin ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  title="Remove admin"
                                  disabled={!!pendingAction}
                                  onClick={() => handleToggleAdmin(member.id, false)}
                                >
                                  <ShieldOff className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  title="Make admin"
                                  disabled={!!pendingAction}
                                  onClick={() => handleToggleAdmin(member.id, true)}
                                >
                                  <Shield className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                title="Remove from group"
                                disabled={!!pendingAction}
                                onClick={() => handleRemove(member.id, false)}
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {isSelf && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                              disabled={!!pendingAction}
                              onClick={() => handleRemove(member.id, true)}
                            >
                              Leave
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
