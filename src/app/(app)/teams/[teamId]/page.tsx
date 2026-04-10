"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus, Play, Users, Settings, Clock, UserPlus, Mail, Shield, Crown, Eye,
  Trash2, ArrowLeft, Copy, ChevronRight
} from "lucide-react";
import { generateSessionCode } from "@/lib/utils";
import type { Team, TeamMember, OrgMember, Session } from "@/types/database";

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const router = useRouter();
  const { currentOrg, membership } = useAuthStore();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<(TeamMember & { org_member: OrgMember })[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tab, setTab] = useState("members");
  const [showInvite, setShowInvite] = useState(false);
  const [showNewSession, setShowNewSession] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [sessionName, setSessionName] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const role = membership?.role ?? "member";

  useEffect(() => {
    loadTeam();
    loadMembers();
    loadSessions();
  }, [teamId]);

  const loadTeam = async () => {
    const { data } = await supabase.from("teams").select("*").eq("id", teamId).single();
    if (data) setTeam(data);
  };

  const loadMembers = async () => {
    const { data } = await supabase
      .from("team_members")
      .select("*, org_members(*)")
      .eq("team_id", teamId);
    if (data) {
      setMembers(data.map((m: any) => ({ ...m, org_member: m.org_members })));
    }
  };

  const loadSessions = async () => {
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });
    if (data) setSessions(data);
  };

  const handleStartSession = async () => {
    if (!sessionName) return;
    setLoading(true);
    const code = generateSessionCode();
    const { data } = await supabase
      .from("sessions")
      .insert({
        team_id: teamId,
        name: sessionName,
        join_code: code,
        status: "active",
        card_deck: team?.card_deck ?? "fibonacci",
        created_by: membership?.id,
      })
      .select()
      .single();
    if (data) router.push(`/session/${data.id}`);
    setLoading(false);
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !currentOrg) return;
    setLoading(true);

    // Find org member by email
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("id")
      .eq("org_id", currentOrg.id)
      .eq("email", inviteEmail)
      .single();

    if (orgMember) {
      await supabase.from("team_members").insert({
        team_id: teamId,
        org_member_id: orgMember.id,
        role: inviteRole,
      });
      await loadMembers();
      setShowInvite(false);
      setInviteEmail("");
    }
    setLoading(false);
  };

  const roleIcon = (r: string) => {
    switch (r) {
      case "admin": return <Crown className="h-3 w-3 text-amber-500" />;
      case "scrum_master": return <Shield className="h-3 w-3 text-indigo-500" />;
      case "observer": return <Eye className="h-3 w-3 text-slate-400" />;
      default: return null;
    }
  };

  if (!team) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="animate-pulse text-slate-400">Loading team...</div>
      </div>
    );
  }

  const activeSession = sessions.find((s) => s.status === "active");

  return (
    <div>
      <AppHeader
        title={team.name}
        description={team.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            {activeSession ? (
              <Link href={`/session/${activeSession.id}`}>
                <Button size="sm">
                  <Play className="h-4 w-4 mr-1" /> Join Active Session
                </Button>
              </Link>
            ) : (role === "admin" || role === "scrum_master") ? (
              <Button size="sm" onClick={() => setShowNewSession(true)}>
                <Play className="h-4 w-4 mr-1" /> Start Session
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="p-8">
        {/* Back */}
        <Link href="/teams" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Teams
        </Link>

        {/* Active Session Banner */}
        {activeSession && (
          <div className="mb-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 p-5 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
              <div>
                <p className="font-semibold">{activeSession.name}</p>
                <p className="text-sm text-indigo-100">Session is live — Code: <span className="font-mono tracking-wider">{activeSession.join_code}</span></p>
              </div>
            </div>
            <Link href={`/session/${activeSession.id}`}>
              <Button variant="secondary" size="sm">Join Now <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </Link>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="members">
              <Users className="h-4 w-4 mr-1.5" /> Members ({members.length})
            </TabsTrigger>
            <TabsTrigger value="sessions">
              <Clock className="h-4 w-4 mr-1.5" /> Sessions ({sessions.length})
            </TabsTrigger>
            {role === "admin" && (
              <TabsTrigger value="settings">
                <Settings className="h-4 w-4 mr-1.5" /> Settings
              </TabsTrigger>
            )}
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">{members.length} members in this team</p>
              {(role === "admin" || role === "scrum_master") && (
                <Button size="sm" variant="outline" onClick={() => setShowInvite(true)}>
                  <UserPlus className="h-4 w-4 mr-1" /> Add Member
                </Button>
              )}
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.org_member?.display_name ?? "User"} src={m.org_member?.avatar_url} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">{m.org_member?.display_name}</p>
                          <p className="text-xs text-slate-500">{m.org_member?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {roleIcon(m.role)}
                        <Badge variant="secondary" className="capitalize text-xs">{m.role.replace("_", " ")}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions">
            <div className="space-y-3">
              {sessions.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500">No sessions yet. Start one to begin estimating!</p>
                  </CardContent>
                </Card>
              ) : (
                sessions.map((s) => (
                  <Card key={s.id} className="hover:shadow-sm transition">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link href={`/session/${s.id}`} className="text-sm font-medium text-slate-900 hover:text-indigo-600">
                            {s.name}
                          </Link>
                          <Badge variant={s.status === "active" ? "default" : s.status === "completed" ? "secondary" : "destructive"} className="text-[10px]">
                            {s.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Code: <span className="font-mono">{s.join_code}</span> · {new Date(s.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {s.status === "active" && (
                        <Link href={`/session/${s.id}`}>
                          <Button size="sm" variant="outline">Join <Play className="h-3 w-3 ml-1" /></Button>
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Team Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Team Name</label>
                  <Input defaultValue={team.name} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Card Deck</label>
                  <Select
                    value={team.card_deck}
                    options={[
                      { value: "fibonacci", label: "Fibonacci (0, 1, 2, 3, 5, 8, 13, 21...)" },
                      { value: "tshirt", label: "T-Shirt (XS, S, M, L, XL, XXL)" },
                      { value: "custom", label: "Custom (Pro)" },
                    ]}
                  />
                </div>
                <div className="pt-4 flex items-center justify-between">
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" /> Delete Team
                  </Button>
                  <Button>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Invite Member Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>Add an existing org member to this team.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInviteMember} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <Input type="email" placeholder="member@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <Select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                options={[
                  { value: "member", label: "Member" },
                  { value: "scrum_master", label: "Scrum Master" },
                  { value: "observer", label: "Observer" },
                ]}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Adding..." : "Add Member"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Session Dialog */}
      <Dialog open={showNewSession} onOpenChange={setShowNewSession}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Session</DialogTitle>
            <DialogDescription>Create a new planning poker session for {team.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Session Name</label>
              <Input placeholder="Sprint 24 Planning" value={sessionName} onChange={(e) => setSessionName(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNewSession(false)}>Cancel</Button>
              <Button onClick={handleStartSession} disabled={loading || !sessionName}>
                {loading ? "Starting..." : "Start Session"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
