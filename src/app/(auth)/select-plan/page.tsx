"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["1 team", "10 members", "Unlimited sessions", "Fibonacci & T-Shirt decks"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$4",
    period: "/user/mo",
    popular: true,
    features: ["10 teams", "50 members", "Custom decks", "Jira integration", "Analytics", "Data export"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    features: ["Unlimited everything", "SSO / SAML", "Audit log", "Dedicated support", "SLA guarantee"],
  },
];

export default function SelectPlanPage() {
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"plan" | "org">("plan");
  const router = useRouter();
  const supabase = createClient();

  const handleContinue = () => {
    if (selectedPlan === "enterprise") {
      // For enterprise, show contact form or redirect
      window.open("mailto:sales@pointit.dev?subject=Enterprise%20Plan%20Inquiry", "_blank");
      return;
    }
    setStep("org");
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        setError(`Auth error: ${authError.message}`);
        setLoading(false);
        return;
      }
      if (!user) { router.push("/login"); return; }

      const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const planLimits = selectedPlan === "pro"
        ? { max_teams: 10, max_team_members: 50, max_sessions_per_month: 1000 }
        : { max_teams: 1, max_team_members: 10, max_sessions_per_month: 100 };

      // Use server-side function to create org + add admin atomically
      const { data: org, error: orgError } = await supabase.rpc("create_organization", {
        p_name: orgName,
        p_slug: slug,
        p_plan: selectedPlan,
        p_plan_limits: planLimits,
      });

      if (orgError) {
        if (orgError.code === "23505" || orgError.message?.includes("organizations_slug_key")) {
          setError(`An organization named "${orgName}" already exists. Try a different name — e.g. add your team or department.`);
        } else {
          setError(`Could not create organization: ${orgError.message}`);
        }
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch (err: any) {
      setError(`Unexpected error: ${err?.message || String(err)}`);
      setLoading(false);
    }
  };

  if (step === "org") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg mx-auto">P</div>
            <h1 className="text-2xl font-bold text-slate-900 mt-4">Name your organization</h1>
            <p className="text-slate-500 mt-2">This is your team&apos;s workspace on PointIt.</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label htmlFor="org" className="block text-sm font-medium text-slate-700 mb-1">Organization name</label>
                <Input id="org" placeholder="Acme Engineering" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
                {orgName && (
                  <p className="text-xs text-slate-400 mt-1">
                    pointit.dev/<span className="font-mono">{orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Check className="h-4 w-4 text-indigo-600" />
                </div>
                <span>You&apos;ll be the <strong className="text-slate-700">Org Admin</strong> — you can invite members next.</span>
              </div>
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating..." : "Create Organization"}
              </Button>
            </form>
          </div>
          <button onClick={() => setStep("plan")} className="block mx-auto mt-4 text-sm text-slate-500 hover:text-slate-700">
            &larr; Back to plan selection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg mx-auto">P</div>
          <h1 className="text-2xl font-bold text-slate-900 mt-4">Choose your plan</h1>
          <p className="text-slate-500 mt-2">Start free and upgrade anytime. No credit card required.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`relative rounded-2xl border p-6 text-left transition-all duration-200 ${
                selectedPlan === plan.id
                  ? "border-indigo-600 bg-white shadow-lg ring-2 ring-indigo-100"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Popular
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedPlan === plan.id ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
                }`}>
                  {selectedPlan === plan.id && <Check className="h-3 w-3 text-white" />}
                </div>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                {plan.period && <span className="text-sm text-slate-500 ml-1">{plan.period}</span>}
              </div>
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <div className="text-center">
          <Button size="lg" onClick={handleContinue} className="px-12">
            Continue with {PLANS.find((p) => p.id === selectedPlan)?.name}
          </Button>
        </div>
      </div>
    </div>
  );
}
