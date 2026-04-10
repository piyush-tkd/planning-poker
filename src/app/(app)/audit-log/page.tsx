"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Lock, Search, Download, Loader2, RefreshCw } from "lucide-react";
import { PLAN_LIMITS } from "@/lib/utils";

interface AuditEntry {
  id: string;
  org_id: string;
  user_id: string;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  "session.started":      { label: "Session Started",   color: "bg-violet-100 text-violet-700" },
  "session.ended":        { label: "Session Ended",     color: "bg-slate-100 text-slate-600" },
  "story.estimated":      { label: "Estimated",         color: "bg-blue-100 text-blue-700" },
  "member.invited":       { label: "Member Invited",    color: "bg-emerald-100 text-emerald-700" },
  "member.removed":       { label: "Member Removed",    color: "bg-red-100 text-red-700" },
  "member.role_changed":  { label: "Role Changed",      color: "bg-amber-100 text-amber-700" },
  "team.created":         { label: "Team Created",      color: "bg-indigo-100 text-indigo-700" },
  "team.deleted":         { label: "Team Deleted",      color: "bg-red-100 text-red-700" },
  "org.settings_updated": { label: "Settings Updated",  color: "bg-blue-100 text-blue-700" },
  "org.plan_changed":     { label: "Plan Changed",      color: "bg-amber-100 text-amber-700" },
  "jira.connected":       { label: "Jira Connected",    color: "bg-emerald-100 text-emerald-700" },
  "jira.disconnected":    { label: "Jira Disconnected", color: "bg-red-100 text-red-700" },
  "jira.estimate_synced": { label: "Jira Synced",       color: "bg-sky-100 text-sky-700" },
  "jira.field_updated":   { label: "Jira Field Updated", color: "bg-sky-100 text-sky-700" },
};

const ACTION_GROUPS = [
  { label: "All", value: "" },
  { label: "Sessions", value: "session" },
  { label: "Stories", value: "story" },
  { label: "Members", value: "member" },
  { label: "Teams", value: "team" },
  { label: "Jira", value: "jira" },
  { label: "Org", value: "org" },
];

function formatDate(date: string) {
  return new Date(date).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function AuditLogPage() {
  const { currentOrg } = useAuthStore();
  const plan = (currentOrg?.plan ?? "free") as keyof typeof PLAN_LIMITS;
  const hasAuditLog = PLAN_LIMITS[plan].auditLog;
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const supabase = createClient();

  const loadEntries = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    let query = supabase
      .from("audit_log")
      .select("*")
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (groupFilter) query = query.like("action", `${groupFilter}.%`);

    const { data } = await query;
    if (data) setEntries(data as AuditEntry[]);
    setLoading(false);
  }, [currentOrg, groupFilter]);

  useEffect(() => {
    if (hasAuditLog) loadEntries();
  }, [hasAuditLog, loadEntries]);

  const handleExportCSV = () => {
    const rows = [
      ["Time", "Action", "Description", "Actor"].join(","),
      ...filtered.map((e) =>
        [
          new Date(e.created_at).toISOString(),
          e.action,
          `"${(e.description || "").replace(/"/g, '""')}"`,
          `"${(e.actor_name || e.user_id).replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!hasAuditLog) {
    return (
      <div>
        <AppHeader title="Audit Log" description="Track all organization activity" />
        <div className="p-8">
          <Card>
            <CardContent className="p-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-6">
                <Lock className="h-10 w-10 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Enterprise Feature</h2>
              <p className="text-slate-500 max-w-md mx-auto mb-6">
                The audit log is available on the Enterprise plan. Track every action — who did what, when, and where.
              </p>
              <Link href="/settings/billing">
                <Button size="lg" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                  <Shield className="h-5 w-5 mr-2" /> Contact Sales for Enterprise
                </Button>
              </Link>

              {/* Blurred preview table */}
              <div className="mt-10 max-w-3xl mx-auto opacity-40 blur-[2px] pointer-events-none overflow-hidden rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-2.5">Time</th>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-2.5">Action</th>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-2.5">Description</th>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-2.5">Actor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {[
                      { action: "member.invited", desc: "Invited sarah@acme.com as Member", actor: "Piyush Baheti", time: "2 min ago" },
                      { action: "session.started", desc: 'Started session "Sprint 43 Planning" for team CEP', actor: "Piyush Baheti", time: "1 hour ago" },
                      { action: "jira.estimate_synced", desc: "Synced 5 SP to CEP-3238", actor: "Piyush Baheti", time: "2 hours ago" },
                    ].map((e, i) => {
                      const cfg = ACTION_CONFIG[e.action];
                      return (
                        <tr key={i}>
                          <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{e.time}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg?.color ?? "bg-slate-100 text-slate-600"}`}>
                              {cfg?.label ?? e.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">{e.desc}</td>
                          <td className="px-4 py-3 text-sm text-slate-500">{e.actor}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (e.description || "").toLowerCase().includes(q) ||
      (e.actor_name || "").toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <AppHeader
        title="Audit Log"
        description={`${entries.length} events tracked`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadEntries} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="p-8">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search events, actors..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {ACTION_GROUPS.map((g) => (
              <button
                key={g.value}
                onClick={() => setGroupFilter(g.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  groupFilter === g.value
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading events...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-sm text-slate-400">
                <Shield className="h-8 w-8 mx-auto mb-3 opacity-30" />
                {search || groupFilter ? "No events match your filters." : "No events recorded yet — start a session or invite a member!"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3 whitespace-nowrap">Time</th>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3 whitespace-nowrap">Action</th>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Description</th>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3 whitespace-nowrap">Actor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map((entry) => {
                      const config = ACTION_CONFIG[entry.action];
                      return (
                        <tr key={entry.id} className="hover:bg-slate-50 transition">
                          {/* Time */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <p className="text-xs font-medium text-slate-600">{timeAgo(entry.created_at)}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(entry.created_at)}</p>
                          </td>

                          {/* Action badge */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${config?.color ?? "bg-slate-100 text-slate-600"}`}>
                              {config?.label ?? entry.action}
                            </span>
                          </td>

                          {/* Description */}
                          <td className="px-5 py-3.5">
                            <p className="text-sm text-slate-800">
                              {entry.description || <span className="text-slate-400 italic">{entry.action}</span>}
                            </p>
                          </td>

                          {/* Actor */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <p className="text-sm text-slate-600">
                              {entry.actor_name || <span className="text-slate-400 text-xs font-mono">{entry.user_id.slice(0, 8)}…</span>}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {filtered.length > 0 && (
          <p className="text-xs text-slate-400 mt-3 text-center">
            Showing {filtered.length} of {entries.length} events
          </p>
        )}
      </div>
    </div>
  );
}
