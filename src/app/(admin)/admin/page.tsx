"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Users, CreditCard, Activity, TrendingUp, Play, Zap, Globe
} from "lucide-react";

export default function AdminOverviewPage() {
  const { isSuperAdmin, isLoading } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();
  const [stats, setStats] = useState({
    totalOrgs: 0,
    totalUsers: 0,
    activeSessionsCount: 0,
    freeOrgs: 0,
    proOrgs: 0,
    enterpriseOrgs: 0,
  });
  const [recentOrgs, setRecentOrgs] = useState<any[]>([]);

  useEffect(() => {
    if (!isLoading && !isSuperAdmin) {
      router.push("/dashboard");
      return;
    }
    if (isSuperAdmin) loadStats();
  }, [isSuperAdmin, isLoading]);

  const loadStats = async () => {
    // Total orgs
    const { count: totalOrgs } = await supabase.from("organizations").select("*", { count: "exact", head: true });
    // Total users
    const { count: totalUsers } = await supabase.from("org_members").select("*", { count: "exact", head: true });
    // Active sessions
    const { count: activeSessionsCount } = await supabase.from("sessions").select("*", { count: "exact", head: true }).eq("status", "active");
    // Orgs by plan
    const { count: freeOrgs } = await supabase.from("organizations").select("*", { count: "exact", head: true }).eq("plan", "free");
    const { count: proOrgs } = await supabase.from("organizations").select("*", { count: "exact", head: true }).eq("plan", "pro");
    const { count: enterpriseOrgs } = await supabase.from("organizations").select("*", { count: "exact", head: true }).eq("plan", "enterprise");
    // Recent orgs
    const { data: recent } = await supabase.from("organizations").select("*").order("created_at", { ascending: false }).limit(5);

    setStats({
      totalOrgs: totalOrgs ?? 0,
      totalUsers: totalUsers ?? 0,
      activeSessionsCount: activeSessionsCount ?? 0,
      freeOrgs: freeOrgs ?? 0,
      proOrgs: proOrgs ?? 0,
      enterpriseOrgs: enterpriseOrgs ?? 0,
    });
    setRecentOrgs(recent ?? []);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-pulse text-slate-400">Loading...</div></div>;
  }

  if (!isSuperAdmin) return null;

  const statCards = [
    { label: "Total Organizations", value: stats.totalOrgs, icon: Building2, color: "bg-red-100 text-red-600" },
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "bg-violet-100 text-violet-600" },
    { label: "Active Sessions", value: stats.activeSessionsCount, icon: Play, color: "bg-emerald-100 text-emerald-600" },
    { label: "Pro Subscriptions", value: stats.proOrgs, icon: CreditCard, color: "bg-amber-100 text-amber-600" },
  ];

  return (
    <div>
      {/* Header */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center px-8">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Platform Overview</h1>
          <p className="text-sm text-slate-500">Super Admin Control Panel</p>
        </div>
      </header>

      <div className="p-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.color}`}>
                    <s.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{s.label}</p>
                    <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Plan Distribution */}
        <Card>
          <CardHeader><CardTitle>Plan Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {[
                { label: "Free", count: stats.freeOrgs, color: "bg-slate-200", textColor: "text-slate-700" },
                { label: "Pro", count: stats.proOrgs, color: "bg-indigo-500", textColor: "text-indigo-700" },
                { label: "Enterprise", count: stats.enterpriseOrgs, color: "bg-amber-500", textColor: "text-amber-700" },
              ].map((p) => (
                <div key={p.label} className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${p.color}`} />
                  <div>
                    <span className={`text-sm font-semibold ${p.textColor}`}>{p.count}</span>
                    <span className="text-sm text-slate-500 ml-1">{p.label}</span>
                  </div>
                </div>
              ))}
            </div>
            {stats.totalOrgs > 0 && (
              <div className="mt-4 h-3 rounded-full bg-slate-100 overflow-hidden flex">
                <div className="bg-slate-300 h-full" style={{ width: `${(stats.freeOrgs / stats.totalOrgs) * 100}%` }} />
                <div className="bg-indigo-500 h-full" style={{ width: `${(stats.proOrgs / stats.totalOrgs) * 100}%` }} />
                <div className="bg-amber-500 h-full" style={{ width: `${(stats.enterpriseOrgs / stats.totalOrgs) * 100}%` }} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orgs */}
        <Card>
          <CardHeader><CardTitle>Recent Organizations</CardTitle></CardHeader>
          <CardContent>
            {recentOrgs.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No organizations yet</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentOrgs.map((org: any) => (
                  <div key={org.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-semibold">
                        {org.name?.[0] ?? "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{org.name}</p>
                        <p className="text-xs text-slate-500">{org.slug} · Created {new Date(org.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Badge variant={org.plan === "pro" ? "pro" : org.plan === "enterprise" ? "enterprise" : "secondary"} className="capitalize">
                      {org.plan}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
