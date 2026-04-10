"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  UserPlus, Search, ArrowLeft, Crown, Shield, Eye, MoreHorizontal, Copy, Check,
  Trash2, Link as LinkIcon, Loader2, AlertCircle
} from "lucide-react";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PLAN_LIMITS } from "@/lib/utils";
import type { OrgMember } from "@/types/database";

export default function MembersPage() {
  const { currentOrg, membership, user } = useAuthStore();
  const actorName = membership?.display_name || user?.email || "Unknown";
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [search, setSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const supabase = createClient();
  const plan = (currentOrg?.plan ?? "free") as keyof typeof PLAN_LIMITS;
  const isAdmin = membership?.role === "admin" || membership?.role === "scrum_master";

  useEffect(() => {
    if (currentOrg) loadMembers();
  }, [currentOrg]);

  const loadMembers = async () => {
    if (!currentOrg) return;
    const { data } = await supabase
      .from("org_members")
      .select("*")
      .eq("org_id", currentOrg.id)
      .order("joined_at", { ascending: true });
    if (data) setMembers(data);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !inviteEmail) return;
    setInviteLoading(true);
    setInviteError("");
    setGeneratedLink(null);

    const { data: token, error } = await supabase.rpc("create_org_invite", {
      p_org_id: currentOrg.id,
      p_email: inviteEmail,
      p_role: inviteRole as any,
    });

    if (error || !token) {
      setInviteError(error?.message ?? "Failed to create invite. The user may already be a member.");
      setInviteLoading(false);
      return;
    }

    // Log the event
    await supabase.rpc("log_member_event", {
      p_org_id: currentOrg.id,
      p_action: "member.invited",
      p_target_email: inviteEmail,
      p_role: inviteRole,
      p_old_role: null,
      p_actor_name: actorName,
    });

    const link = `${window.location.origin}/invite/${token}`;
    setGeneratedLink(link);
    setInviteLoading(false);
  };

  const copyInviteLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const resetInviteDialog = () => {
    setShowInvite(false);
    setInviteEmail("");
    setInviteName("");
    setInviteRole("member");
    setInviteError("");
    setGeneratedLink(null);
    setLinkCopied(false);
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    const member = members.find((m) => m.id === memberId);
    await supabase.from("org_members").update({ role: newRole }).eq("id", memberId);
    if (currentOrg && member) {
      await supabase.rpc("log_member_event", {
        p_org_id: currentOrg.id,
        p_action: "member.role_changed",
        p_target_email: member.email,
        p_role: newRole,
        p_old_role: member.role,
        p_actor_name: actorName,
      });
    }
    await loadMembers();
  };

  const handleRemoveMember = async (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    await supabase.from("org_members").delete().eq("id", memberId);
    if (currentOrg && member) {
      await supabase.rpc("log_member_event", {
        p_org_id: currentOrg.id,
        p_action: "member.removed",
        p_target_email: member.email,
        p_role: member.role,
        p_old_role: null,
        p_actor_name: actorName,
      });
    }
    await loadMembers();
  };

  const filtered = members.filter(
    (m) =>
      m.display_name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  const roleIcon = (role: string) => {
    switch (role) {
      case "admin": return <Crown className="h-3.5 w-3.5 text-amber-500" />;
      case "scrum_master": return <Shield className="h-3.5 w-3.5 text-indigo-500" />;
      case "observer": return <Eye className="h-3.5 w-3.5 text-slate-400" />;
      default: return null;
    }
  };

  return (
    <div>
      <AppHeader
        title="Members"
        description={`${members.length} members in your organization`}
        actions={
          isAdmin ? (
            <Button size="sm" onClick={() => setShowInvite(true)}>
              <UserPlus className="h-4 w-4 mr-1" /> Invite Member
            </Button>
          ) : undefined
        }
      />

      <div className="p-8">
        <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link>

        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search members…" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {/* Members Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Member</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Role</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Joined</th>
                    {isAdmin && (
                      <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={m.display_name} src={m.avatar_url} size="sm" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">{m.display_name}</p>
                            <p className="text-xs text-slate-500">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          {roleIcon(m.role)}
                          <Badge variant="secondary" className="capitalize text-xs">{m.role.replace("_", " ")}</Badge>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {new Date(m.joined_at).toLocaleDateString()}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-4 text-right">
                          {m.id !== membership?.id && (
                            <DropdownMenu
                              trigger={
                                <button className="p-1.5 rounded hover:bg-slate-100">
                                  <MoreHorizontal className="h-4 w-4 text-slate-400" />
                                </button>
                              }
                            >
                              <DropdownMenuItem onClick={() => handleChangeRole(m.id, "admin")}>
                                <Crown className="h-4 w-4 text-amber-500" /> Make Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleChangeRole(m.id, "scrum_master")}>
                                <Shield className="h-4 w-4 text-indigo-500" /> Make Scrum Master
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleChangeRole(m.id, "member")}>
                                Make Member
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600" onClick={() => handleRemoveMember(m.id)}>
                                <Trash2 className="h-4 w-4" /> Remove
                              </DropdownMenuItem>
                            </DropdownMenu>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 4 : 3} className="px-5 py-10 text-center text-slate-400 text-sm">
                        No members found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={(open) => { if (!open) resetInviteDialog(); else setShowInvite(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Generate a one-time invite link to share with your colleague. Links expire in 7 days.
            </DialogDescription>
          </DialogHeader>

          {/* Step 1 — fill in details */}
          {!generatedLink && (
            <form onSubmit={handleInvite} className="space-y-4 mt-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <Select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  options={[
                    { value: "member", label: "Member — Can vote in sessions" },
                    { value: "scrum_master", label: "Scrum Master — Can create and manage sessions" },
                    { value: "admin", label: "Admin — Full access including billing" },
                    { value: "observer", label: "Observer — Can watch but not vote" },
                  ]}
                />
              </div>

              {inviteError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {inviteError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={resetInviteDialog}>Cancel</Button>
                <Button type="submit" disabled={inviteLoading}>
                  {inviteLoading ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Generating…</>
                  ) : (
                    <><LinkIcon className="h-4 w-4 mr-1.5" /> Generate Link</>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Step 2 — show copyable link */}
          {generatedLink && (
            <div className="space-y-4 mt-2">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                <p className="text-sm font-medium text-emerald-700 mb-2">Invite link ready!</p>
                <p className="text-xs text-slate-500 mb-3">
                  Share this link with <span className="font-semibold text-slate-700">{inviteEmail}</span>.
                  It expires in 7 days and can only be used once.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 truncate">
                    {generatedLink}
                  </code>
                  <button
                    onClick={copyInviteLink}
                    className="shrink-0 p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition"
                  >
                    {linkCopied
                      ? <Check className="h-4 w-4 text-emerald-500" />
                      : <Copy className="h-4 w-4 text-slate-500" />
                    }
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1">
                <Button variant="outline" size="sm" onClick={() => { setGeneratedLink(null); setInviteEmail(""); setInviteError(""); }}>
                  Invite another
                </Button>
                <Button size="sm" onClick={resetInviteDialog}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
