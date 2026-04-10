"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Users, Settings, Play, ArrowRight, Search } from "lucide-react";
import { PLAN_LIMITS } from "@/lib/utils";
import type { Team } from "@/types/database";

export default function TeamsPage() {
  const { currentOrg, membership, user } = useAuthStore();
  const actorName = membership?.display_name || user?.email || "Unknown";
  const [teams, setTeams] = useState<(Team & { member_count: number })[]>([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const role = membership?.role ?? "member";
  const plan = (currentOrg?.plan ?? "free") as keyof typeof PLAN_LIMITS;
  const teamLimit = PLAN_LIMITS[plan].teams;

  useEffect(() => {
    if (currentOrg) loadTeams();
  }, [currentOrg]);

  const loadTeams = async () => {
    if (!currentOrg) return;
    const { data } = await supabase
      .from("teams")
      .select("*, team_members(count)")
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: false });

    if (data) {
      setTeams(data.map((t: any) => ({
        ...t,
        member_count: t.team_members?.[0]?.count ?? 0,
      })));
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !newTeamName) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("teams")
      .insert({
        org_id: currentOrg.id,
        name: newTeamName,
        description: newTeamDesc || null,
        card_deck: "fibonacci",
      })
      .select()
      .single();

    if (data && membership) {
      // Add creator as team member
      await supabase.from("team_members").insert({
        team_id: data.id,
        org_member_id: membership.id,
        role: membership.role,
      });
      // Log audit event
      await supabase.rpc("log_team_created", {
        p_org_id: currentOrg.id,
        p_team_id: data.id,
        p_name: newTeamName,
        p_actor_name: actorName,
      });
      await loadTeams();
      setShowCreate(false);
      setNewTeamName("");
      setNewTeamDesc("");
    }
    setLoading(false);
  };

  const filtered = teams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const atLimit = teamLimit !== -1 && teams.length >= teamLimit;

  return (
    <div>
      <AppHeader
        title="Teams"
        description={`${teams.length} team${teams.length !== 1 ? "s" : ""}${teamLimit !== -1 ? ` of ${teamLimit}` : ""}`}
        actions={
          role === "admin" && (
            <Button
              size="sm"
              onClick={() => setShowCreate(true)}
              disabled={atLimit}
            >
              <Plus className="h-4 w-4 mr-1" /> New Team
              {atLimit && <Badge variant="pro" className="ml-2 text-[10px]">Upgrade</Badge>}
            </Button>
          )
        }
      />

      <div className="p-8">
        {/* Search */}
        {teams.length > 0 && (
          <div className="relative mb-6 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search teams..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {/* Team limit warning */}
        {atLimit && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-800">
                Team limit reached ({teams.length}/{teamLimit})
              </p>
              <p className="text-sm text-amber-600">Upgrade to Pro for up to 10 teams.</p>
            </div>
            <Link href="/settings/billing">
              <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-100">
                Upgrade Plan
              </Button>
            </Link>
          </div>
        )}

        {/* Teams Grid */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {search ? "No teams match your search" : "No teams yet"}
              </h3>
              <p className="text-slate-500 mb-4">
                {search ? "Try a different search term." : "Create your first team to start planning together."}
              </p>
              {!search && role === "admin" && (
                <Button onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Create Team
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((team) => (
              <Card key={team.id} className="group hover:shadow-lg hover:border-indigo-200 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                      {team.name[0]}
                    </div>
                    <Badge variant="secondary">{team.card_deck}</Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">{team.name}</h3>
                  {team.description && (
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">{team.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" /> {team.member_count} members
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/teams/${team.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        View Team <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                    {(role === "admin" || role === "scrum_master") && (
                      <Button variant="ghost" size="icon" className="text-slate-400">
                        <Settings className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Team Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
            <DialogDescription>Teams are groups of people who estimate together.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTeam} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Team Name</label>
              <Input placeholder="e.g. Platform Squad" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
              <Textarea placeholder="What does this team work on?" value={newTeamDesc} onChange={(e) => setNewTeamDesc(e.target.value)} rows={3} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={loading || !newTeamName}>
                {loading ? "Creating..." : "Create Team"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
