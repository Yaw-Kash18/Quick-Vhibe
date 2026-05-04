import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Search, Shield, Trash2, Users, UserCheck, Crown,
  Loader2, RefreshCw, MessageSquare, ScrollText, LayoutDashboard,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/App";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useMutation, useQueryClient as useQC } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AdminUser {
  id: number;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  googleId: string | null;
  lastSeenAt: string;
  createdAt: string;
}

interface ActionLog {
  id: number;
  timestamp: string;
  adminUsername: string;
  targetUsername: string;
  action: "promote" | "demote" | "delete";
  detail: string;
}

function getAuthToken() {
  return localStorage.getItem("auth_token");
}
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getAuthToken()}` };
}

function useAdminUsers() {
  return useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch(`${basePath}/api/admin/users`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Access denied");
      return res.json();
    },
    refetchInterval: 15000,
  });
}

function useAdminStats() {
  return useQuery<{ totalUsers: number; totalAdmins: number }>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch(`${basePath}/api/admin/stats`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 15000,
  });
}

function useActionLogs() {
  return useQuery<ActionLog[]>({
    queryKey: ["admin-action-logs"],
    queryFn: async () => {
      const res = await fetch(`${basePath}/api/admin/action-logs`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 10000,
  });
}

function useChangeRole() {
  const qc = useQC();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const res = await fetch(`${basePath}/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ role }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-action-logs"] });
    },
  });
}

function useDeleteUser() {
  const qc = useQC();
  return useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`${basePath}/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-action-logs"] });
    },
  });
}

type Tab = "overview" | "users" | "logs";

export default function AdminPage() {
  const { data: me, isLoading: meLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: users, isLoading: usersLoading, refetch } = useAdminUsers();
  const { data: stats } = useAdminStats();
  const { data: actionLogs = [], isLoading: logsLoading } = useActionLogs();
  const changeRole = useChangeRole();
  const deleteUser = useDeleteUser();
  const { toast } = useToast();
  const { setUserRole } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [pendingPromote, setPendingPromote] = useState<AdminUser | null>(null);

  if (meLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!me || me.role !== "admin") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Shield className="h-12 w-12 text-destructive/50" />
        <p className="text-lg font-semibold">Admin access required</p>
        <Button variant="ghost" asChild>
          <Link href="/chat"><ArrowLeft className="h-4 w-4 mr-2" />Back to Chat</Link>
        </Button>
      </div>
    );
  }

  // Sync role from fresh profile data into localStorage/context
  if (me.role !== localStorage.getItem("user_role")) {
    setUserRole(me.role);
  }

  const filtered = (users ?? []).filter((u) => {
    const q = search.toLowerCase();
    return !q || u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || (u.displayName ?? "").toLowerCase().includes(q);
  });

  const handleRoleChange = async (user: AdminUser, newRole: string) => {
    try {
      await changeRole.mutateAsync({ userId: user.id, role: newRole });
      toast({
        title: newRole === "admin"
          ? `✓ @${user.username} promoted to admin`
          : `✓ @${user.username} demoted to user`,
      });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (user: AdminUser) => {
    try {
      await deleteUser.mutateAsync(user.id);
      toast({ title: `@${user.username} deleted` });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const getInitials = (u: AdminUser) => (u.displayName ?? u.username).charAt(0).toUpperCase();

  const tabCls = (t: Tab) =>
    `flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
      activeTab === t
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
    }`;

  const actionBadgeColor = (action: string) => {
    if (action === "promote") return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    if (action === "demote") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Crown className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">Signed in as @{me.username}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-9"
              onClick={() => setLocation("/chat")}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Open Chat</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { refetch(); }} title="Refresh">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* ── Nav tabs ───────────────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-muted/30 rounded-xl p-1">
          <button className={tabCls("overview")} onClick={() => setActiveTab("overview")}>
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </button>
          <button className={tabCls("users")} onClick={() => setActiveTab("users")}>
            <Users className="h-4 w-4" />
            Users
            {stats && <span className="ml-1 text-xs opacity-60">{stats.totalUsers}</span>}
          </button>
          <button className={tabCls("logs")} onClick={() => setActiveTab("logs")}>
            <ScrollText className="h-4 w-4" />
            Action Log
            {actionLogs.length > 0 && <span className="ml-1 text-xs opacity-60">{actionLogs.length}</span>}
          </button>
        </div>

        {/* ── Tab content ────────────────────────────────────────── */}
        <AnimatePresence mode="wait">

          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-border/50 bg-card/50">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{stats?.totalUsers ?? "—"}</p>
                      <p className="text-sm text-muted-foreground">Total Users</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50 bg-card/50">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                      <Crown className="h-6 w-6 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{stats?.totalAdmins ?? "—"}</p>
                      <p className="text-sm text-muted-foreground">Admins</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50 bg-card/50">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <UserCheck className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{stats ? stats.totalUsers - stats.totalAdmins : "—"}</p>
                      <p className="text-sm text-muted-foreground">Regular Users</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick actions */}
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-border/30">
                  {[
                    { label: "Manage Users", desc: "Promote, demote, or delete accounts", tab: "users" as Tab, icon: Users },
                    { label: "Action Log", desc: "Review all recent admin actions", tab: "logs" as Tab, icon: ScrollText },
                    { label: "Open Chat", desc: "Switch to full messaging interface", tab: null, icon: MessageSquare },
                  ].map(({ label, desc, tab, icon: Icon }) => (
                    <button
                      key={label}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
                      onClick={() => tab ? setActiveTab(tab) : setLocation("/chat")}
                    >
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                    </button>
                  ))}
                </CardContent>
              </Card>

              {/* Recent actions preview */}
              {actionLogs.length > 0 && (
                <Card className="border-border/50 bg-card/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Recent Activity</CardTitle>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveTab("logs")}>
                        View all
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {actionLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex items-center gap-3 px-5 py-3 border-t border-border/30 first:border-t-0">
                        <Badge variant="outline" className={`text-[10px] capitalize flex-shrink-0 ${actionBadgeColor(log.action)}`}>
                          {log.action}
                        </Badge>
                        <p className="text-xs text-muted-foreground flex-1 truncate">{log.detail}</p>
                        <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">
                          {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {/* USERS TAB */}
          {activeTab === "users" && (
            <motion.div key="users" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle>User Database</CardTitle>
                      <CardDescription>All registered accounts — promote, demote, or remove</CardDescription>
                    </div>
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search users..."
                        className="pl-9 h-9 bg-muted/50 border-0 text-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {usersLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground text-sm">No users found</div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {/* Table header */}
                      <div className="hidden md:grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-4 px-6 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        <span className="w-10">Avatar</span>
                        <span>User</span>
                        <span>Email</span>
                        <span>Role</span>
                        <span>Joined</span>
                        <span>Actions</span>
                      </div>
                      {filtered.map((user) => {
                        const isSelf = user.id === me.id;
                        return (
                          <div key={user.id} className="flex md:grid md:grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-3 md:gap-4 items-center px-4 md:px-6 py-3.5 hover:bg-muted/20 transition-colors">
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarImage src={user.avatarUrl ?? undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-sm">{getInitials(user)}</AvatarFallback>
                            </Avatar>

                            <div className="flex-1 md:flex-none min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium truncate">
                                  {user.displayName ?? user.username}
                                  {isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                                </p>
                                {user.googleId && (
                                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full flex-shrink-0">G</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                            </div>

                            <div className="hidden md:block min-w-0">
                              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                              <p className="text-xs text-muted-foreground/50 truncate">
                                Last seen {formatDistanceToNow(new Date(user.lastSeenAt), { addSuffix: true })}
                              </p>
                            </div>

                            <div>
                              {user.role === "admin" ? (
                                <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 gap-1 text-[11px] whitespace-nowrap">
                                  <Crown className="h-2.5 w-2.5" />Admin
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[11px] gap-1 whitespace-nowrap">
                                  <Users className="h-2.5 w-2.5" />User
                                </Badge>
                              )}
                            </div>

                            <div className="hidden md:block text-right">
                              <p className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {!isSelf && (
                                <>
                                  {/* Promote/Demote with confirmation */}
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-2.5 text-xs gap-1"
                                        disabled={changeRole.isPending}
                                      >
                                        {user.role === "admin"
                                          ? <><Users className="h-3 w-3" />Demote</>
                                          : <><Crown className="h-3 w-3" />Promote</>}
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          {user.role === "admin" ? "Demote to User?" : "Promote to Admin?"}
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          {user.role === "admin"
                                            ? `@${user.username} will lose all admin privileges and access to the admin dashboard.`
                                            : `@${user.username} will gain full admin access — including the ability to manage all users.`}
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleRoleChange(user, user.role === "admin" ? "user" : "admin")}
                                        >
                                          {user.role === "admin" ? "Yes, demote" : "Yes, promote"}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>

                                  {/* Delete with confirmation */}
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete user?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will permanently delete <strong>@{user.username}</strong> ({user.email}) and all their data. This cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-destructive hover:bg-destructive/90"
                                          onClick={() => handleDelete(user)}
                                        >
                                          Delete permanently
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ACTION LOG TAB */}
          {activeTab === "logs" && (
            <motion.div key="logs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle>Action Log</CardTitle>
                  <CardDescription>Record of all admin actions performed in this session</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {logsLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : actionLogs.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                      <ScrollText className="h-8 w-8 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No actions logged yet</p>
                      <p className="text-xs mt-1 opacity-60">Promote, demote, and delete actions will appear here</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {actionLogs.map((log) => (
                        <div key={log.id} className="flex items-start gap-4 px-6 py-4">
                          <Badge variant="outline" className={`text-[10px] capitalize flex-shrink-0 mt-0.5 ${actionBadgeColor(log.action)}`}>
                            {log.action}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{log.detail}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(log.timestamp).toLocaleString()} · {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
