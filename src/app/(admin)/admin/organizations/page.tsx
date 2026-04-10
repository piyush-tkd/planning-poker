"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Search, Building2, Users, CreditCard, Edit2, ArrowUpCircle, ArrowDownCircle, Check
} from "lucide-react";
import { PLAN_LIMITS } from "@/lib/utils";

export default function AdminOrganizationsPage() {
  const { isSuperAdmin, isLoading } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();
  const [orgs, setOrgs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [newPlan, setNewPlan] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!isLoading && !isSuperAdmin) { router.push("/dashboard"); return; }
    if (isSuperAdmin) loadOrgs();
  }, [isSuperAdmin, isLoading]);

  const loadOrgs = async () => {
    let query = supabase.from("organizations").select("*, org_members(count)").order("created_at", { ascending: false });
    if (planFilter) query = query.eq("plan", planFilter);
    const { data } = await query;
    if (data) {
      setOrgs(data.map((o: any) => ({ ...o, member_count: o.org_members?.[0]?.count ?? 0 })));
    }
  };

  const handleChangePlan = async () => {
    if (!selectedOrg || !newPlan) return;
    setSaving(true);

    const planLimits = PLAN_LIMITS[newPlan as keyof typeof PLAN_LIMITS];

    await supabase.from("organizations").update({
      plan: newPlan,
      plan_limits: planLimits,
    }).eq("id", selectedOrg.id);

    setSuccess(`${selectedOrg.name} upgraded to ${newPlan.toUpperCase()}`);
    setTimeout(() => setSuccess(""), 3000);
    setSaving(false);
    setShowChangePlan(false);
    setSelectedOrg(null);
    loadOrgs();
  };

  const openChangePlan = (org: any) => {
    setSelectedOrg(org);
    setNewPlan(org.plan);
    setShowChangePlan(true);
  };

  const filtered = orgs.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="flex items-center justify-center h-screen"><div className="animate-pulse text-slate-400">Loading...</div></div>;
  if (!isSuperAdmin) return null;

  return (
    <div>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Organizations</h1>
          <p className="text-sm text-slate-500">{orgs.length} organizations on the platform</p>
        </div>
      </header>

      <div className="p-8">
        {/* Success Banner */}
        {success && (
          <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
            <Check className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-800">{success}</span>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search organizations..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select
            value={planFilter}
            onChange={(e) => { setPlanFilter(e.target.value); }}
            placeholder="All plans"
            options={[
              { value: "free", label: "Free" },
              { value: "pro", label: "Pro" },
              { value: "enterprise", label: "Enterprise" },
            ]}
          />
          {planFilter && (
            <Button variant="ghost" size="sm" onClick={() => setPlanFilter("")}>Clear</Button>
          )}
        </div>

        {/* Orgs Table */}
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Organization</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Plan</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Members</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Created</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((org) => (
                  <tr key={org.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-semibold">
                          {org.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{org.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{org.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={org.plan === "pro" ? "pro" : org.plan === "enterprise" ? "enterprise" : "secondary"} className="capitalize">
                        {org.plan}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600 flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-slate-400" /> {org.member_count}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {new Date(org.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => openChangePlan(org)}>
                        <CreditCard className="h-3.5 w-3.5 mr-1" /> Change Plan
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">No organizations found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Change Plan Dialog */}
      <Dialog open={showChangePlan} onOpenChange={setShowChangePlan}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan for {selectedOrg?.name}</DialogTitle>
            <DialogDescription>Select the new plan tier for this organization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
              <span>Current plan:</span>
              <Badge variant={selectedOrg?.plan === "pro" ? "pro" : selectedOrg?.plan === "enterprise" ? "enterprise" : "secondary"} className="capitalize">
                {selectedOrg?.plan}
              </Badge>
            </div>

            <div className="space-y-2">
              {[
                { id: "free", label: "Free", desc: "1 team, 10 members", icon: "🆓" },
                { id: "pro", label: "Pro", desc: "10 teams, 50 members, analytics, Jira", icon: "⚡" },
                { id: "enterprise", label: "Enterprise", desc: "Unlimited everything, SSO, audit log", icon: "🏢" },
              ].map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setNewPlan(plan.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-all ${
                    newPlan === plan.id
                      ? "border-red-600 bg-red-50 ring-1 ring-red-200"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{plan.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{plan.label}</p>
                        <p className="text-xs text-slate-500">{plan.desc}</p>
                      </div>
                    </div>
                    {newPlan === plan.id && (
                      <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowChangePlan(false)}>Cancel</Button>
              <Button
                onClick={handleChangePlan}
                disabled={saving || newPlan === selectedOrg?.plan}
                className="bg-red-600 hover:bg-red-700"
              >
                {saving ? "Updating..." : "Update Plan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
