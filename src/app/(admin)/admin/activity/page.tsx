"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Activity } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  "member.invited": "bg-emerald-100 text-emerald-700",
  "member.removed": "bg-red-100 text-red-700",
  "member.role_changed": "bg-amber-100 text-amber-700",
  "team.created": "bg-indigo-100 text-indigo-700",
  "team.deleted": "bg-red-100 text-red-700",
  "session.started": "bg-violet-100 text-violet-700",
  "session.ended": "bg-slate-100 text-slate-700",
  "org.plan_changed": "bg-amber-100 text-amber-700",
  "org.settings_updated": "bg-blue-100 text-blue-700",
};

export default function AdminActivityPage() {
  const { isSuperAdmin, isLoading } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();
  const [entries, setEntries] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isLoading && !isSuperAdmin) { router.push("/dashboard"); return; }
    if (isSuperAdmin) loadActivity();
  }, [isSuperAdmin, isLoading]);

  const loadActivity = async () => {
    const { data } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) setEntries(data);
  };

  const filtered = entries.filter((e) =>
    e.action.toLowerCase().includes(search.toLowerCase()) ||
    e.entity_type.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading || !isSuperAdmin) return null;

  return (
    <div>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center px-8">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Platform Activity</h1>
          <p className="text-sm text-slate-500">All audit events across every organization</p>
        </div>
      </header>

      <div className="p-8">
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search events..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No activity recorded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {filtered.map((e) => (
                  <div key={e.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition">
                    <Badge className={ACTION_COLORS[e.action] ?? "bg-slate-100 text-slate-700"} style={{ fontSize: "11px", minWidth: "120px", justifyContent: "center" }}>
                      {e.action}
                    </Badge>
                    <span className="text-sm text-slate-700 flex-1">{e.entity_type} <span className="font-mono text-xs text-slate-400">{e.entity_id?.slice(0, 8)}</span></span>
                    <span className="text-xs text-slate-400">{new Date(e.created_at).toLocaleString()}</span>
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
