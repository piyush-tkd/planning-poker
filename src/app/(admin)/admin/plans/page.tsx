"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLAN_LIMITS } from "@/lib/utils";
import { Check, X } from "lucide-react";

export default function AdminPlansPage() {
  const { isSuperAdmin, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isSuperAdmin) router.push("/dashboard");
  }, [isSuperAdmin, isLoading]);

  if (isLoading || !isSuperAdmin) return null;

  const plans = Object.entries(PLAN_LIMITS) as [string, typeof PLAN_LIMITS.free][];

  return (
    <div>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center px-8">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Plan Management</h1>
          <p className="text-sm text-slate-500">View and manage plan tier configurations</p>
        </div>
      </header>

      <div className="p-8">
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map(([name, limits]) => (
            <Card key={name} className={name === "pro" ? "border-indigo-200 shadow-lg" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="capitalize">{name}</CardTitle>
                  <Badge variant={name === "pro" ? "pro" : name === "enterprise" ? "enterprise" : "secondary"}>
                    {name === "free" ? "$0" : name === "pro" ? "$4/user/mo" : "Custom"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Teams</span>
                    <span className="font-medium text-slate-900">{limits.teams === -1 ? "Unlimited" : limits.teams}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Members per team</span>
                    <span className="font-medium text-slate-900">{limits.membersPerTeam === -1 ? "Unlimited" : limits.membersPerTeam}</span>
                  </div>
                  {Object.entries(limits).filter(([k]) => !["teams", "membersPerTeam", "sessions"].includes(k)).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                      {val ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <X className="h-4 w-4 text-slate-300" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
