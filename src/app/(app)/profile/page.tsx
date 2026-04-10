"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Save, LogOut, Camera, Shield, Mail, Calendar, Spade } from "lucide-react";

export default function ProfilePage() {
  const { user, membership, currentOrg } = useAuthStore();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name },
    });
    if (!error && membership) {
      await supabase.from("org_members").update({ display_name: name }).eq("id", membership.id);
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div>
      <AppHeader title="Profile" description="Your account settings" />

      <div className="p-8 max-w-2xl">
        {/* Avatar */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar name={user?.name ?? "User"} src={user?.avatar_url} size="lg" />
                <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50">
                  <Camera className="h-4 w-4 text-slate-500" />
                </button>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{user?.name ?? "User"}</h2>
                <p className="text-sm text-slate-500">{user?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="capitalize">
                    <Shield className="h-3 w-3 mr-1" />
                    {membership?.role?.replace("_", " ") ?? "member"}
                  </Badge>
                  <Badge variant={currentOrg?.plan === "pro" ? "pro" : "secondary"}>
                    {currentOrg?.name ?? "Organization"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Info */}
        <Card className="mb-6">
          <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <Input value={user?.email ?? ""} disabled className="bg-slate-50" />
              <p className="text-xs text-slate-400 mt-1">Email is managed through Google OAuth and cannot be changed here.</p>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card className="mb-6">
          <CardHeader><CardTitle>Your Estimation Stats</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-slate-50">
                <Spade className="h-5 w-5 text-indigo-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-slate-900">—</p>
                <p className="text-xs text-slate-500">Sessions Joined</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-slate-50">
                <Calendar className="h-5 w-5 text-violet-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-slate-900">—</p>
                <p className="text-xs text-slate-500">Stories Voted</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-slate-50">
                <Mail className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-slate-900">—</p>
                <p className="text-xs text-slate-500">Consensus Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sign Out */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">Sign Out</p>
                <p className="text-sm text-slate-500">Sign out of your PointIt account.</p>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-1" /> Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}