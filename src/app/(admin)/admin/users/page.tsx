"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, Crown, Shield, Eye, Users, Edit2, Check } from "lucide-react";

export default function AdminUsersPage() {
  const { isSuperAdmin, isLoading } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showEditRole, setShowEditRole] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newRole, setNewRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!isLoading && !isSuperAdmin) { router.push("/dashboard"); return; }
    if (isSuperAdmin) loadUsers();
  }, [isSuperAdmin, isLoading]);

  const loadUsers = async () => {
    let query = supabase.from("org_members").select("*, organizations(name, plan)").order("joined_at", { ascending: false });
    if (roleFilter) query = query.eq("role", roleFilter);
    const { data } = await query;
    if (data) setUsers(data);
  };

  const handleChangeRole = async () => {
    if (!selectedUser || !newRole) return;
    setSaving(true);
    await supabase.from("org_members").update({ role: newRole }).eq("id", selectedUser.id);
    setSuccess(`${selectedUser.display_name}'s role changed to ${newRole}`);
    setTimeout(() => setSuccess(""), 3000);
    setSaving(false);
    setShowEditRole(false);
    loadUsers();
  };

  const roleIcon = (role: string) => {
    switch (role) {
      case "admin": return <Crown className="h-3.5 w-3.5 text-amber-500" />;
      case "scrum_master": return <Shield className="h-3.5 w-3.5 text-indigo-500" />;
      case "observer": return <Eye className="h-3.5 w-3.5 text-slate-400" />;
      default: return <Users className="h-3.5 w-3.5 text-slate-400" />;
    }
  };

  const filtered = users.filter((u) =>
    u.display_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="flex items-center justify-center h-screen"><div className="animate-pulse text-slate-400">Loading...</div></div>;
  if (!isSuperAdmin) return null;

  return (
    <div>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center px-8">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">All Users</h1>
          <p className="text-sm text-slate-500">{users.length} users across all organizations</p>
        </div>
      </header>

      <div className="p-8">
        {success && (
          <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
            <Check className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-800">{success}</span>
          </div>
        )}

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search users..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            placeholder="All roles"
            options={[
              { value: "admin", label: "Admin" },
              { value: "scrum_master", label: "Scrum Master" },
              { value: "member", label: "Member" },
              { value: "observer", label: "Observer" },
            ]}
          />
          {roleFilter && <Button variant="ghost" size="sm" onClick={() => setRoleFilter("")}>Clear</Button>}
        </div>

        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">User</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Organization</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Role</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Joined</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.display_name} src={u.avatar_url} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">{u.display_name}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <p className="text-sm text-slate-700">{u.organizations?.name ?? "—"}</p>
                        <Badge variant={u.organizations?.plan === "pro" ? "pro" : "secondary"} className="text-[10px] capitalize">
                          {u.organizations?.plan ?? "free"}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        {roleIcon(u.role)}
                        <Badge variant="secondary" className="capitalize text-xs">{u.role.replace("_", " ")}</Badge>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {new Date(u.joined_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSelectedUser(u); setNewRole(u.role); setShowEditRole(true); }}
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit Role
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={showEditRole} onOpenChange={setShowEditRole}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role for {selectedUser?.display_name}</DialogTitle>
            <DialogDescription>Update this user's role in their organization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-3 text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
              <Avatar name={selectedUser?.display_name ?? ""} src={selectedUser?.avatar_url} size="sm" />
              <div>
                <p className="font-medium text-slate-900">{selectedUser?.display_name}</p>
                <p className="text-xs">{selectedUser?.email} · {selectedUser?.organizations?.name}</p>
              </div>
            </div>

            <Select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              options={[
                { value: "admin", label: "Admin — Full org access + billing" },
                { value: "scrum_master", label: "Scrum Master — Create & manage sessions" },
                { value: "member", label: "Member — Vote in sessions" },
                { value: "observer", label: "Observer — Watch only, no voting" },
              ]}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowEditRole(false)}>Cancel</Button>
              <Button onClick={handleChangeRole} disabled={saving || newRole === selectedUser?.role} className="bg-red-600 hover:bg-red-700">
                {saving ? "Updating..." : "Update Role"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
