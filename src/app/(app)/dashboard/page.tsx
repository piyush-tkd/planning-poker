"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Plus, Play, Users, Clock, ArrowRight, Spade,
  Zap, Calendar, BookOpen, Eye, ChevronRight, Copy, Check, Loader2, AlertCircle
} from "lucide-react";
import { generateSessionCode } from "@/lib/utils";

interface TeamSummary {
  id: string;
  name: string;
  member_count: number;
  active_session: { id: string; name: string; join_code: string | null } | null;
}

interface RecentSession {
  id: string;
  name: string;
  team_name: string;
  status: string;
  created_at: string;
}

interface UpcomingSession {
  id: string;
  name: string;
  team_name: string;
  team_id: string;
  status: string;
  scheduled_for: string | null;
  description: string | null;
  story_count: number;
  join_token: string | null;
  created_at: string;
}

type NewSessionMode = "now" | "draft";

export default function DashboardPage() {
  const { user, currentOrg, membership } = useAuthStore();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([]);
  const [showNewSession, setShowNewSession] = useState(false);
  const [showJoinSession, setShowJoinSession] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [newSessionName, setNewSessionName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [newSessionMode, setNewSessionMode] = useState<NewSessionMode>("now");
  const [scheduledFor, setScheduledFor] = useState("");
  const [sessionDescription, setSessionDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();
  const role = membership?.role ?? "member";
  const isSM = role === "admin" || role === "scrum_master";

  useEffect(() => {
    if (currentOrg) loadDashboardData();
  }, [currentOrg]);

  // Realtime: re-fetch whenever sessions change
  useEffect(() => {
    if (!currentOrg) return;
    const channel = supabase
      .channel(`dashboard-sessions:${currentOrg.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions" }, () => loadDashboardData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sessions" }, () => loadDashboardData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentOrg]);

  const loadDashboardData = async () => {
    if (!currentOrg) return;

    const { data: teamData } = await supabase
      .from("teams")
      .select("id, name, team_members(count)")
      .eq("org_id", currentOrg.id);

    if (!teamData) return;
    const teamIds = teamData.map((t) => t.id);

    // Active sessions
    const { data: activeSessions } = teamIds.length > 0
      ? await supabase.from("sessions").select("id, name, team_id, join_code").in("team_id", teamIds).eq("status", "active")
      : { data: [] };

    const activeByTeam = new Map(
      (activeSessions ?? []).map((s: any) => [s.team_id, { id: s.id, name: s.name, join_code: s.join_code }])
    );

    const summaries: TeamSummary[] = teamData.map((t: any) => ({
      id: t.id,
      name: t.name,
      member_count: t.team_members?.[0]?.count ?? 0,
      active_session: activeByTeam.get(t.id) ?? null,
    }));

    setTeams(summaries);
    if (summaries.length > 0 && !selectedTeamId) setSelectedTeamId(summaries[0].id);

    // Recent sessions
    if (teamIds.length > 0) {
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("id, name, status, created_at, team_id, teams(name)")
        .in("team_id", teamIds)
        .neq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(6);

      if (sessionData) {
        setRecentSessions(
          sessionData.map((s: any) => ({
            id: s.id,
            name: s.name,
            team_name: s.teams?.name ?? "Unknown",
            status: s.status,
            created_at: s.created_at,
          }))
        );
      }
    }

    // Upcoming draft sessions — gracefully skip if RPC not deployed yet
    try {
      const { data: upcoming, error: upcomingError } = await supabase.rpc("get_upcoming_sessions", { p_org_id: currentOrg.id });
      if (!upcomingError && Array.isArray(upcoming)) setUpcomingSessions(upcoming as UpcomingSession[]);
    } catch (_) {
      // RPC not available yet — ignore silently
    }
  };

  const resetNewSessionDialog = () => {
    setNewSessionName("");
    setNewSessionMode("now");
    setScheduledFor("");
    setSessionDescription("");
    setError(null);
  };

  const handleCreateSession = async () => {
    if (!selectedTeamId || !newSessionName.trim()) return;
    setLoading(true);
    setError(null);

    try {
      if (newSessionMode === "now") {
        const code = generateSessionCode();
        const { data, error: rpcError } = await supabase.rpc("create_session", {
          p_team_id: selectedTeamId,
          p_name: newSessionName.trim(),
          p_join_code: code,
          p_card_deck: "fibonacci",
        });
        if (rpcError) { setError(rpcError.message); setLoading(false); return; }
        if (data?.error) { setError(data.error); setLoading(false); return; }
        if (data?.id) router.push(`/session/${data.id}`);
      } else {
        const { data, error: rpcError } = await supabase.rpc("create_draft_session", {
          p_team_id: selectedTeamId,
          p_name: newSessionName.trim(),
          p_card_deck: "fibonacci",
          p_scheduled_for: scheduledFor || null,
          p_description: sessionDescription.trim() || null,
        });
        if (rpcError) {
          setError(rpcError.message);
          setLoading(false); return;
        }
        if (data?.error) { setError(data.error); setLoading(false); return; }
        if (data?.id) {
          setShowNewSession(false);
          resetNewSessionDialog();
          await loadDashboardData();
          router.push(`/session/${data.id}/preview`);
        }
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred");
    }
    setLoading(false);
  };

  const handleJoinSession = async () => {
    const code = joinCode.trim();
    if (!code) return;
    setJoinLoading(true);
    setJoinError(null);

    const { data, error: dbError } = await supabase
      .from("sessions")
      .select("id, name, status")
      .ilike("join_code", code)
      .single();

    if (dbError || !data) {
      setJoinError("No session found with that code. Double-check and try again.");
      setJoinLoading(false);
      return;
    }
    if (data.status === "ended") {
      setJoinError("That session has already ended.");
      setJoinLoading(false);
      return;
    }
    if (data.status === "draft") {
      router.push(`/session/${data.id}/preview`);
      return;
    }
    router.push(`/session/${data.id}`);
  };

  const stats = [
    { label: "Teams", value: teams.length, icon: Users, color: "text-indigo-600 bg-indigo-100" },
    { label: "Active Now", value: teams.filter((t) => t.active_session).length, icon: Play, color: "text-emerald-600 bg-emerald-100" },
    { label: "Upcoming", value: upcomingSessions.length, icon: Calendar, color: "text-amber-600 bg-amber-100" },
    { label: "Your Role", value: role.replace("_", " "), icon: Spade, color: "text-violet-600 bg-violet-100", isText: true },
  ];

  return (
    <div>
      <AppHeader
        title="Dashboard"
        description={`Welcome back, ${user?.name?.split(" ")[0] ?? "there"}!`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowJoinSession(true)}>
              <Zap className="h-4 w-4 mr-1" /> Join Session
            </Button>
            {isSM && (
              <Button size="sm" onClick={() => { resetNewSessionDialog(); setShowNewSession(true); }}>
                <Plus className="h-4 w-4 mr-1" /> New Session
              </Button>
            )}
          </div>
        }
      />

      <div className="p-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{stat.label}</p>
                    <p className={`font-semibold text-slate-900 ${stat.isText ? "text-sm capitalize" : "text-2xl"}`}>
                      {stat.value}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Upcoming Sessions */}
        {upcomingSessions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-500" />
                Upcoming Sessions
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingSessions.map((session) => (
                <Card key={session.id} className="border-amber-200 bg-amber-50/40 hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">{session.name}</h3>
                        <p className="text-sm text-slate-500 mt-0.5">{session.team_name}</p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 ml-2 shrink-0">Draft</Badge>
                    </div>
                    {session.description && (
                      <p className="text-xs text-slate-600 mb-3 line-clamp-2">{session.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {session.story_count} {session.story_count === 1 ? "story" : "stories"}
                      </span>
                      {session.scheduled_for && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(session.scheduled_for).toLocaleDateString("en-US", {
                            month: "short", day: "numeric",
                            hour: "numeric", minute: "2-digit"
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/session/${session.id}/preview`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          {isSM ? "Manage" : "Preview"}
                        </Button>
                      </Link>
                      {isSM && (
                        <Link href={`/session/${session.id}/preview`}>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                            <Play className="h-3.5 w-3.5 mr-1" /> Start
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Teams */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Your Teams</h2>
              {role === "admin" && (
                <Link href="/teams" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                  Manage <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>

            {teams.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No teams yet</h3>
                  <p className="text-slate-500 mb-4">Create your first team to start estimating together.</p>
                  {role === "admin" && (
                    <Link href="/teams">
                      <Button><Plus className="h-4 w-4 mr-1" /> Create Team</Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {teams.map((team) => (
                  <Card key={team.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold">
                            {team.name[0]}
                          </div>
                          <div>
                            <Link href={`/teams/${team.id}`} className="font-medium text-slate-900 hover:text-indigo-600 transition">
                              {team.name}
                            </Link>
                            <p className="text-sm text-slate-500">{team.member_count} members</p>
                          </div>
                        </div>
                        {team.active_session ? (
                          <div className="flex items-center gap-2">
                            {/* Join code pill — click to copy */}
                            {team.active_session.join_code && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigator.clipboard.writeText(team.active_session!.join_code!);
                                  setCopiedCode(team.active_session!.join_code!);
                                  setTimeout(() => setCopiedCode(null), 2000);
                                }}
                                title="Copy join code"
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 transition text-xs font-mono font-semibold text-slate-700"
                              >
                                {copiedCode === team.active_session.join_code
                                  ? <><Check className="h-3 w-3 text-emerald-500" /> Copied!</>
                                  : <><Copy className="h-3 w-3 text-slate-400" /> {team.active_session.join_code}</>
                                }
                              </button>
                            )}
                            <Link href={`/session/${team.active_session.id}`}>
                              <Badge variant="default" className="cursor-pointer flex items-center gap-1 bg-emerald-600">
                                <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse" />
                                Live: {team.active_session.name}
                              </Badge>
                            </Link>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">No active session</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Recent Sessions */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Sessions</h2>
            {recentSessions.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No sessions yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {recentSessions.map((session) => (
                  <Card key={session.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <Link href={`/session/${session.id}`} className="text-sm font-medium text-slate-900 hover:text-indigo-600">
                            {session.name}
                          </Link>
                          <p className="text-xs text-slate-500 mt-0.5">{session.team_name}</p>
                        </div>
                        <Badge variant={session.status === "active" ? "default" : "secondary"} className="text-[10px]">
                          {session.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        {new Date(session.created_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Join Card */}
        <Card className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0">
          <CardContent className="p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white mb-1">Join a session instantly</h3>
                <p className="text-indigo-100 text-sm">
                  Enter the session code shared by your Scrum Master.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-w-[220px]">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="ABC123"
                    className="w-32 bg-white/10 border-white/20 text-white placeholder:text-white/50 uppercase tracking-widest text-center font-mono text-base h-10"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => { setJoinCode(e.target.value); setJoinError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleJoinSession(); }}
                    autoComplete="off"
                  />
                  <Button
                    variant="secondary"
                    onClick={handleJoinSession}
                    disabled={joinLoading || !joinCode.trim()}
                    className="h-10 px-5"
                  >
                    {joinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join"}
                  </Button>
                </div>
                {joinError && (
                  <div className="flex items-start gap-1.5 text-xs text-white/90 bg-white/15 rounded-lg px-3 py-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-200" />
                    {joinError}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Session Dialog */}
      <Dialog open={showNewSession} onOpenChange={(open) => { setShowNewSession(open); if (!open) resetNewSessionDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Planning Session</DialogTitle>
            <DialogDescription>Start now or plan ahead for your team.</DialogDescription>
          </DialogHeader>

          {/* Mode Toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden mt-4">
            <button
              onClick={() => setNewSessionMode("now")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                newSessionMode === "now" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Play className="h-4 w-4" /> Start Now
            </button>
            <button
              onClick={() => setNewSessionMode("draft")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                newSessionMode === "draft" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Calendar className="h-4 w-4" /> Plan Ahead
            </button>
          </div>

          <div className="space-y-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Session Name</label>
              <Input
                placeholder={newSessionMode === "now" ? "Sprint 24 Planning" : "Sprint 25 Backlog Refinement"}
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Team</label>
              <Select
                options={teams.map((t) => ({ value: t.id, label: t.name }))}
                placeholder="Select a team..."
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
              />
            </div>

            {newSessionMode === "draft" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Scheduled Date & Time <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <Input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    rows={3}
                    placeholder="What will the team be estimating? Any context to share..."
                    value={sessionDescription}
                    onChange={(e) => setSessionDescription(e.target.value)}
                  />
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  <strong>Plan Ahead</strong> creates a draft session. Add stories, then share a preview link with your team. Start the session when you're ready.
                </div>
              </>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowNewSession(false); resetNewSessionDialog(); }}>Cancel</Button>
              <Button
                onClick={handleCreateSession}
                disabled={loading || !newSessionName || !selectedTeamId}
                className={newSessionMode === "draft" ? "bg-amber-500 hover:bg-amber-600" : ""}
              >
                {loading
                  ? (newSessionMode === "draft" ? "Creating..." : "Starting...")
                  : (newSessionMode === "draft" ? "Create Draft" : "Start Session")
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Session Dialog */}
      <Dialog open={showJoinSession} onOpenChange={setShowJoinSession}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join a Session</DialogTitle>
            <DialogDescription>Enter the 6-digit code shared by your Scrum Master.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              placeholder="Enter code..."
              className="text-center text-2xl tracking-[0.3em] font-mono uppercase"
              maxLength={6}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowJoinSession(false)}>Cancel</Button>
              <Button onClick={handleJoinSession} disabled={joinCode.length < 6}>Join Session</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
