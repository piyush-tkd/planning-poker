"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Building2, CreditCard, Users, Shield, Globe, Trash2, Save, ExternalLink, Plug
} from "lucide-react";
import { IntegrationsContent } from "@/components/settings/integrations-content";

export default function SettingsPage() {
  const { currentOrg, membership, user } = useAuthStore();
  const actorName = membership?.display_name || user?.email || "Unknown";
  const [tab, setTab] = useState("general");
  const [orgName, setOrgName] = useState(currentOrg?.name ?? "");
  const [orgSlug, setOrgSlug] = useState(currentOrg?.slug ?? "");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  // Sync form fields when currentOrg loads (auth may not be ready on first render)
  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name ?? "");
      setOrgSlug(currentOrg.slug ?? "");
    }
  }, [currentOrg?.id]);

  const handleSave = async () => {
    if (!currentOrg) return;
    setSaving(true);
    const oldName = currentOrg.name;
    await supabase.from("organizations").update({ name: orgName, slug: orgSlug }).eq("id", currentOrg.id);
    // Log the event
    if (orgName !== oldName) {
      await supabase.rpc("log_org_event", {
        p_org_id: currentOrg.id,
        p_action: "org.settings_updated",
        p_description: `Renamed organization from "${oldName}" to "${orgName}"`,
        p_metadata: { field: "name", old_value: oldName, new_value: orgName },
        p_actor_name: actorName,
      });
    }
    setSaving(false);
  };

  const plan = currentOrg?.plan ?? "free";

  return (
    <div>
      <AppHeader title="Settings" description="Manage your organization settings" />

      <div className="p-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="general"><Building2 className="h-4 w-4 mr-1.5" /> General</TabsTrigger>
            <TabsTrigger value="billing"><CreditCard className="h-4 w-4 mr-1.5" /> Billing</TabsTrigger>
            <TabsTrigger value="members"><Users className="h-4 w-4 mr-1.5" /> Members</TabsTrigger>
            <TabsTrigger value="integrations"><Plug className="h-4 w-4 mr-1.5" /> Integrations</TabsTrigger>
          </TabsList>

          {/* General */}
          <TabsContent value="general">
            <div className="max-w-2xl space-y-6">
              <Card>
                <CardHeader><CardTitle>Organization Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Organization Name</label>
                    <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">URL Slug</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400">pointit.dev/</span>
                      <Input value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} className="max-w-xs font-mono" />
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button onClick={handleSave} disabled={saving}>
                      <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Current Plan</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={plan === "pro" ? "pro" : plan === "enterprise" ? "enterprise" : "secondary"} className="text-sm px-3 py-1">
                        {plan.charAt(0).toUpperCase() + plan.slice(1)}
                      </Badge>
                      <span className="text-sm text-slate-500">
                        {plan === "free" ? "1 team · 10 members" : plan === "pro" ? "10 teams · 50 members" : "Unlimited"}
                      </span>
                    </div>
                    {plan === "free" && (
                      <Link href="/settings/billing">
                        <Button size="sm">Upgrade to Pro</Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-200">
                <CardHeader><CardTitle className="text-red-600">Danger Zone</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500 mb-4">
                    Deleting your organization will permanently remove all teams, sessions, and data. This cannot be undone.
                  </p>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" /> Delete Organization
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Billing */}
          <TabsContent value="billing">
            <div className="max-w-2xl">
              <Card>
                <CardContent className="p-8 text-center">
                  <CreditCard className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Billing & Plans</h3>
                  <p className="text-slate-500 mb-4">Manage your subscription and payment methods.</p>
                  <Link href="/settings/billing">
                    <Button>Go to Billing <ExternalLink className="h-4 w-4 ml-1" /></Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Members */}
          <TabsContent value="members">
            <div className="max-w-2xl">
              <Card>
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">Organization Members</h3>
                  <p className="text-slate-500 mb-4">Invite and manage members across your organization.</p>
                  <Link href="/settings/members">
                    <Button>Manage Members <ExternalLink className="h-4 w-4 ml-1" /></Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="integrations">
            <IntegrationsContent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
