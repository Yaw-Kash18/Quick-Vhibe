import { useState } from "react";
import { Link } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { ArrowLeft, Search, Shield, Trash2, Users, UserCheck, Crown, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useMutation, useQueryClient as useQC } from "@tanstack/react-query";

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
    refetchInterval: 10000,
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
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); },
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
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); },
  });
}

export default function AdminPage() {
  const { data: me, isLoading: meLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: users, isLoading: usersLoading, refetch } = useAdminUsers();
  const { data: stats } = useAdminStats();
  const changeRole = useChangeRole();
  const deleteUser = useDeleteUser();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  if (meLoading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!me || me.role !== "admin") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Shield className="h-12 w-12 text-destructive/50" />
        <p className="text-lg font-semibold">Admin access required</p>
        <Button variant="ghost" asChild><Link href="/settings"><ArrowLeft className="h-4 w-4 mr-2" />Back to Settings</Link></Button>
      </div>
    );
  }

  const filtered = (users ?? []).filter((u) => {
    const q = search.toLowerCase();
    return !q || u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || (u.displayName ?? "").toLowerCase().includes(q);
  });

  const handleRoleChange = async (user: AdminUser, newRole: string) => {
    try {
      await changeRole.mutateAsync({ userId: user.id, role: newRole });
      toast({ title: newRole === "admin" ? `${user.username} promoted to admin` : `${user.username} demoted to user` });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (user: AdminUser) => {
    try {
      await deleteUser.mutateAsync(user.id);
      toast({ title: `${user.username} deleted` });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const getInitials = (u: AdminUser) => (u.displayName ?? u.username).charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage users and system access</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalUsers ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Crown className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalAdmins ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Admins</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats ? stats.totalUsers - stats.totalAdmins : "—"}</p>
                <p className="text-xs text-muted-foreground">Regular Users</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User table */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>User Database</CardTitle>
                <CardDescription>All registered accounts with join dates and roles</CardDescription>
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
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">No users found</div>
            ) : (
              <div className="divide-y divide-border/30">
                {/* Table header */}
                <div className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-4 px-6 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
                    <div key={user.id} className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-4 items-center px-6 py-3.5 hover:bg-muted/20 transition-colors">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarImage src={user.avatarUrl ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">{getInitials(user)}</AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
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

                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        <p className="text-xs text-muted-foreground/50 truncate">
                          Last seen {formatDistanceToNow(new Date(user.lastSeenAt), { addSuffix: true })}
                        </p>
                      </div>

                      <div>
                        {user.role === "admin" ? (
                          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 gap-1 text-[11px]">
                            <Crown className="h-2.5 w-2.5" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[11px] gap-1">
                            <Users className="h-2.5 w-2.5" />
                            User
                          </Badge>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                        </p>
                        <p className="text-[10px] text-muted-foreground/50">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!isSelf && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs gap-1"
                              disabled={changeRole.isPending}
                              onClick={() => handleRoleChange(user, user.role === "admin" ? "user" : "admin")}
                            >
                              {user.role === "admin" ? (
                                <><Users className="h-3 w-3" />Demote</>
                              ) : (
                                <><Crown className="h-3 w-3" />Promote</>
                              )}
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete user?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete <strong>@{user.username}</strong> ({user.email}) and all their data. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive hover:bg-destructive/90"
                                    onClick={() => handleDelete(user)}
                                  >
                                    Delete user
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
      </div>
    </div>
  );
}
