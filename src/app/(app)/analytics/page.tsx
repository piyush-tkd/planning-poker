"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  BarChart3, TrendingUp, Target, Users, Clock, Download, Lock,
  ArrowUp, ArrowDown, Minus, Loader2, CheckCircle2, AlertCircle,
  FileText, Calendar
} from "lucide-react";
import { PLAN_LIMITS } from "@/lib/utils";

/* ── Types ────────────────────────────────────────────────────── */
interface SessionRow {
  id: string;
  name: string;
  status: string;
  created_at: string;
  ended_at: string | null;
  team_id: string;
  team_name: string;
}

interface StoryRow {
  id: string;
  session_id: string;
  title: string;
  jira_key: string | null;
  final_estimate: string | null;
  vote_status: string;
}

interface VoteRow {
  story_id: string;
  value: string;
}

interface TeamStat {
  id: string;
  name: string;
  sessions: number;
  stories: number;
  estimated: number;
  consensus: number;
}

interface ChartBar { label: string; count: number; }

/* ── Helpers ──────────────────────────────────────────────────── */
function buildTimeSeries(sessions: SessionRow[], days: number): ChartBar[] {
  const now = new Date();
  const bars: ChartBar[] = [];

  if (days <= 7) {
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      bars.push({
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        count: sessions.filter((s) => new Date(s.created_at).toDateString() === d.toDateString()).length,
      });
    }
  } else {
    const weeks = Math.ceil(days / 7);
    for (let i = weeks - 1; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      bars.push({
        label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count: sessions.filter((s) => {
          const d = new Date(s.created_at);
          return d >= start && d <= end;
        }).length,
      });
    }
  }
  return bars;
}

function consensusRate(storyIds: string[], votes: VoteRow[]): number {
  if (!storyIds.length) return 0;
  let consensus = 0;
  for (const sid of storyIds) {
    const sv = votes.filter((v) => v.story_id === sid).map((v) => v.value);
    if (sv.length > 0 && new Set(sv).size === 1) consensus++;
  }
  return Math.round((consensus / storyIds.length) * 100);
}

function exportSessionCSV(session: SessionRow, stories: StoryRow[]) {
  const rows = [
    ["Story", "Jira Key", "Final Estimate", "Status"],
    ...stories
      .filter((s) => s.session_id === session.id)
      .map((s) => [s.title, s.jira_key ?? "", s.final_estimate ?? "", s.vote_status]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${session.name.replace(/\s+/g, "_")}_${session.created_at.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAllCSV(sessions: SessionRow[], stories: StoryRow[]) {
  const rows = [["Session", "Team", "Date", "Story", "Jira Key", "Estimate"]];
  for (const s of sessions) {
    const ss = stories.filter((st) => st.session_id === s.id);
    if (ss.length === 0) rows.push([s.name, s.team_name, s.created_at.slice(0, 10), "", "", ""]);
    else for (const st of ss) {
      rows.push([s.name, s.team_name, s.created_at.slice(0, 10), st.title, st.jira_key ?? "", st.final_estimate ?? ""]);
    }
  }
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pointit_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── SVG bar chart ────────────────────────────────────────────── */
function BarChart({ bars, color = "#6366f1" }: { bars: ChartBar[]; color?: string }) {
  const max = Math.max(...bars.map((b) => b.count), 1);
  const H = 160;
  const barW = Math.max(16, Math.floor(560 / bars.length) - 6);
  return (
    <div className="w-full overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${bars.length * (barW + 8)} ${H + 32}`} className="min-w-[320px]">
        {bars.map((b, i) => {
          const bh = Math.max(4, (b.count / max) * H);
          const x = i * (barW + 8) + 4;
          const y = H - bh;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh} rx={4} fill={b.count > 0 ? color : "#e2e8f0"} opacity={0.9} />
              {b.count > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={10} fill="#64748b" fontWeight={600}>{b.count}</text>
              )}
              <text x={x + barW / 2} y={H + 18} textAnchor="middle" fontSize={9} fill="#94a3b8">{b.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const { currentOrg } = useAuthStore();
  const plan = (currentOrg?.plan ?? "free") as keyof typeof PLAN_LIMITS;
  const hasAnalytics = PLAN_LIMITS[plan].analytics;
  const supabase = createClient();

  const [timeRange, setTimeRange] = useState("30d");
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStat[]>([]);
  const [tab, setTab] = useState<"overview" | "teams" | "sessions">("overview");

  useEffect(() => {
    if (currentOrg && hasAnalytics) loadData();
  }, [currentOrg, timeRange, hasAnalytics]);

  const loadData = async () => {
    if (!currentOrg) return;
    setLoading(true);

    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Teams for this org
    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name")
      .eq("org_id", currentOrg.id);

    if (!teamsData?.length) { setLoading(false); return; }
    const teamMap = new Map(teamsData.map((t) => [t.id, t.name]));
    const teamIds = teamsData.map((t) => t.id);

    // Sessions in range
    const { data: sessData } = await supabase
      .from("sessions")
      .select("id, name, status, created_at, ended_at, team_id")
      .in("team_id", teamIds)
      .in("status", ["completed", "active", "cancelled"])
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });

    const mapped: SessionRow[] = (sessData ?? []).map((s: any) => ({
      ...s,
      team_name: teamMap.get(s.team_id) ?? "Unknown",
    }));
    setSessions(mapped);

    // Stories
    const sessionIds = mapped.map((s) => s.id);
    if (sessionIds.length > 0) {
      const { data: storyData } = await supabase
        .from("stories")
        .select("id, session_id, title, jira_key, final_estimate, vote_status")
        .in("session_id", sessionIds);
      const storyRows: StoryRow[] = storyData ?? [];
      setStories(storyRows);

      // Votes (for consensus calc)
      const storyIds = storyRows.map((s) => s.id);
      if (storyIds.length > 0) {
        const { data: voteData } = await supabase
          .from("votes")
          .select("story_id, value")
          .in("story_id", storyIds);
        setVotes(voteData ?? []);

        // Team stats
        const stats: TeamStat[] = teamsData.map((t) => {
          const tSessions = mapped.filter((s) => s.team_id === t.id);
          const tStories = storyRows.filter((s) => tSessions.some((ts) => ts.id === s.session_id));
          const tStoryIds = tStories.map((s) => s.id);
          return {
            id: t.id,
            name: t.name,
            sessions: tSessions.length,
            stories: tStories.length,
            estimated: tStories.filter((s) => s.final_estimate).length,
            consensus: consensusRate(tStoryIds, voteData ?? []),
          };
        }).filter((t) => t.sessions > 0);
        setTeamStats(stats);
      } else {
        setVotes([]);
        setTeamStats([]);
      }
    } else {
      setStories([]);
      setVotes([]);
      setTeamStats([]);
    }

    setLoading(false);
  };

  /* ── Computed metrics ── */
  const totalEstimated = stories.filter((s) => s.final_estimate).length;
  const storyIds = stories.map((s) => s.id);
  const cRate = consensusRate(storyIds, votes);
  const jiraStories = stories.filter((s) => s.jira_key).length;
  const timeSeries = buildTimeSeries(sessions, timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90);

  // Point distribution
  const estimateCounts: Record<string, number> = {};
  stories.forEach((s) => { if (s.final_estimate) estimateCounts[s.final_estimate] = (estimateCounts[s.final_estimate] || 0) + 1; });
  const estimateDistribution = Object.entries(estimateCounts)
    .sort(([a], [b]) => isNaN(Number(a)) ? 1 : isNaN(Number(b)) ? -1 : Number(a) - Number(b));
  const maxEstCount = Math.max(...Object.values(estimateCounts), 1);

  /* ── Upsell gate ── */
  if (!hasAnalytics) {
    return (
      <div>
        <AppHeader title="Analytics" description="Track estimation trends and team performance" />
        <div className="p-8">
          <Card>
            <CardContent className="p-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-6">
                <Lock className="h-10 w-10 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Unlock Analytics</h2>
              <p className="text-slate-500 max-w-md mx-auto mb-6">
                Upgrade to Pro to access estimation trends, team consensus metrics, velocity charts, and CSV exports.
              </p>
              <Link href="/settings/billing">
                <Button size="lg"><TrendingUp className="h-5 w-5 mr-2" /> Upgrade to Pro</Button>
              </Link>
              <div className="mt-8 grid md:grid-cols-3 gap-4 max-w-2xl mx-auto opacity-40 pointer-events-none select-none">
                {[
                  { label: "Total Sessions", value: "42", icon: BarChart3 },
                  { label: "Consensus Rate", value: "72%", icon: Users },
                  { label: "Stories Estimated", value: "186", icon: Target },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 blur-sm">
                    <s.icon className="h-5 w-5 text-indigo-600 mb-2" />
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const kpis = [
    { label: "Sessions", value: sessions.length, icon: BarChart3, color: "bg-indigo-100 text-indigo-600" },
    { label: "Stories Estimated", value: totalEstimated, icon: Target, color: "bg-violet-100 text-violet-600" },
    { label: "Consensus Rate", value: `${cRate}%`, icon: CheckCircle2, color: "bg-emerald-100 text-emerald-600" },
    { label: "Jira-linked Stories", value: jiraStories, icon: FileText, color: "bg-amber-100 text-amber-600" },
  ];

  return (
    <div>
      <AppHeader
        title="Analytics"
        description="Estimation trends and team performance"
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              options={[
                { value: "7d", label: "Last 7 days" },
                { value: "30d", label: "Last 30 days" },
                { value: "90d", label: "Last 90 days" },
              ]}
            />
            {sessions.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => exportAllCSV(sessions, stories)}>
                <Download className="h-4 w-4 mr-1" /> Export All
              </Button>
            )}
          </div>
        }
      />

      <div className="p-8 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          </div>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="p-16 text-center">
              <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900 mb-1">No sessions yet</h3>
              <p className="text-sm text-slate-400">
                Start running planning sessions — your data will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {kpis.map((k) => (
                <Card key={k.label}>
                  <CardContent className="p-5">
                    <div className={`w-10 h-10 rounded-lg ${k.color} flex items-center justify-center mb-3`}>
                      <k.icon className="h-5 w-5" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{k.value}</p>
                    <p className="text-sm text-slate-500">{k.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
              {(["overview", "teams", "sessions"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
                    tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Overview tab */}
            {tab === "overview" && (
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Sessions over time */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Sessions Over Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {timeSeries.every((b) => b.count === 0) ? (
                      <div className="h-48 flex items-center justify-center text-sm text-slate-400">
                        No sessions in this period
                      </div>
                    ) : (
                      <BarChart bars={timeSeries} color="#6366f1" />
                    )}
                  </CardContent>
                </Card>

                {/* Estimate distribution */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Estimate Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {estimateDistribution.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-sm text-slate-400">
                        No estimates recorded yet
                      </div>
                    ) : (
                      <div className="space-y-2 py-2">
                        {estimateDistribution.map(([val, count]) => (
                          <div key={val} className="flex items-center gap-3">
                            <span className="w-8 text-right text-sm font-mono font-semibold text-slate-600 shrink-0">{val}</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                              <div
                                className="h-6 rounded-full bg-indigo-500 flex items-center pl-3 text-xs text-white font-medium transition-all duration-500"
                                style={{ width: `${(count / maxEstCount) * 100}%`, minWidth: "2rem" }}
                              >
                                {count}
                              </div>
                            </div>
                            <span className="text-xs text-slate-400 w-8 shrink-0 text-right">
                              {Math.round((count / totalEstimated) * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Consensus breakdown */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Consensus Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-6">
                      {/* Donut ring */}
                      <div className="relative w-24 h-24 shrink-0">
                        <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.8" />
                          <circle
                            cx="18" cy="18" r="15.9" fill="none"
                            stroke={cRate >= 70 ? "#10b981" : cRate >= 40 ? "#f59e0b" : "#ef4444"}
                            strokeWidth="3.8"
                            strokeDasharray={`${cRate} ${100 - cRate}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-slate-900">
                          {cRate}%
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-emerald-400" />
                          <span className="text-sm text-slate-600">
                            {storyIds.filter((sid) => {
                              const sv = votes.filter((v) => v.story_id === sid).map((v) => v.value);
                              return sv.length > 0 && new Set(sv).size === 1;
                            }).length} stories with consensus
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-amber-400" />
                          <span className="text-sm text-slate-600">
                            {storyIds.filter((sid) => {
                              const sv = votes.filter((v) => v.story_id === sid).map((v) => v.value);
                              return sv.length > 0 && new Set(sv).size > 1;
                            }).length} needed discussion
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-slate-300" />
                          <span className="text-sm text-slate-600">
                            {storyIds.filter((sid) => votes.filter((v) => v.story_id === sid).length === 0).length} no votes
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick stats */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Quick Stats</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        {
                          label: "Avg. stories per session",
                          value: sessions.length > 0 ? (stories.length / sessions.length).toFixed(1) : "—",
                        },
                        {
                          label: "Estimation rate",
                          value: stories.length > 0 ? `${Math.round((totalEstimated / stories.length) * 100)}%` : "—",
                        },
                        {
                          label: "Most common estimate",
                          value: estimateDistribution.length > 0
                            ? estimateDistribution.sort(([, a], [, b]) => b - a)[0][0]
                            : "—",
                        },
                        {
                          label: "Jira-linked stories",
                          value: stories.length > 0 ? `${Math.round((jiraStories / stories.length) * 100)}%` : "—",
                        },
                      ].map((s) => (
                        <div key={s.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                          <span className="text-sm text-slate-500">{s.label}</span>
                          <span className="text-sm font-semibold text-slate-900">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Teams tab */}
            {tab === "teams" && (
              <Card>
                <CardHeader>
                  <CardTitle>Team Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  {teamStats.length === 0 ? (
                    <p className="text-sm text-slate-400 py-6 text-center">No team data available.</p>
                  ) : (
                    <div className="space-y-4">
                      {teamStats.map((t) => (
                        <div key={t.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                                {t.name[0]}
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">{t.name}</p>
                                <p className="text-xs text-slate-500">{t.sessions} sessions · {t.stories} stories</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-slate-900">{t.consensus}%</p>
                              <p className="text-xs text-slate-400">consensus</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { label: "Sessions", v: t.sessions },
                              { label: "Stories", v: t.stories },
                              { label: "Estimated", v: t.estimated },
                            ].map((s) => (
                              <div key={s.label} className="bg-white rounded-lg p-2.5 text-center border border-slate-100">
                                <p className="text-lg font-bold text-slate-900">{s.v}</p>
                                <p className="text-xs text-slate-400">{s.label}</p>
                              </div>
                            ))}
                          </div>
                          {/* Consensus bar */}
                          <div className="mt-3">
                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                  t.consensus >= 70 ? "bg-emerald-500" : t.consensus >= 40 ? "bg-amber-500" : "bg-red-400"
                                }`}
                                style={{ width: `${t.consensus}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Sessions tab */}
            {tab === "sessions" && (
              <Card>
                <CardHeader>
                  <CardTitle>Session History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left">
                          <th className="pb-3 pr-4 font-medium text-slate-500 whitespace-nowrap">Session</th>
                          <th className="pb-3 pr-4 font-medium text-slate-500 whitespace-nowrap">Team</th>
                          <th className="pb-3 pr-4 font-medium text-slate-500 whitespace-nowrap text-center">Stories</th>
                          <th className="pb-3 pr-4 font-medium text-slate-500 whitespace-nowrap text-center">Estimated</th>
                          <th className="pb-3 pr-4 font-medium text-slate-500 whitespace-nowrap text-center">Consensus</th>
                          <th className="pb-3 pr-4 font-medium text-slate-500 whitespace-nowrap">Date</th>
                          <th className="pb-3 font-medium text-slate-500 whitespace-nowrap">Status</th>
                          <th className="pb-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {sessions.map((s) => {
                          const ss = stories.filter((st) => st.session_id === s.id);
                          const est = ss.filter((st) => st.final_estimate).length;
                          const sid = ss.map((st) => st.id);
                          const cr = consensusRate(sid, votes);
                          return (
                            <tr key={s.id} className="hover:bg-slate-50 transition">
                              <td className="py-3 pr-4">
                                <Link href={`/session/${s.id}`} className="font-medium text-slate-900 hover:text-indigo-600 truncate max-w-[160px] block">
                                  {s.name}
                                </Link>
                              </td>
                              <td className="py-3 pr-4 text-slate-500">{s.team_name}</td>
                              <td className="py-3 pr-4 text-center text-slate-700">{ss.length}</td>
                              <td className="py-3 pr-4 text-center text-slate-700">{est}</td>
                              <td className="py-3 pr-4 text-center">
                                {sid.length > 0 ? (
                                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    cr >= 70 ? "bg-emerald-100 text-emerald-700" : cr >= 40 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                                  }`}>{cr}%</span>
                                ) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="py-3 pr-4 text-slate-400 whitespace-nowrap text-xs">
                                {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </td>
                              <td className="py-3 pr-4">
                                <Badge variant={s.status === "active" ? "default" : "secondary"} className="text-[10px] capitalize">
                                  {s.status}
                                </Badge>
                              </td>
                              <td className="py-3 text-right">
                                {ss.length > 0 && (
                                  <button
                                    onClick={() => exportSessionCSV(s, stories)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                                    title="Export CSV"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
