"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, Zap, Crown, Building2 } from "lucide-react";

const PLANS = [
  {
    id: "free", name: "Free", price: "$0", period: "forever",
    icon: Zap, color: "bg-slate-100 text-slate-600",
    features: ["1 team", "10 members per team", "Unlimited sessions", "Fibonacci & T-Shirt decks", "7-day session history"],
  },
  {
    id: "pro", name: "Pro", price: "$4", period: "per user/mo",
    icon: Crown, color: "bg-indigo-100 text-indigo-600", popular: true,
    features: ["Up to 10 teams", "50 members per team", "Custom card decks", "Jira integration", "Advanced analytics", "Data export (CSV)", "90-day history", "Priority support"],
  },
  {
    id: "enterprise", name: "Enterprise", price: "Custom", period: "annual",
    icon: Building2, color: "bg-amber-100 text-amber-600",
    features: ["Unlimited teams & members", "SSO / SAML", "Full audit log", "Custom integrations", "Dedicated account manager", "Unlimited history", "99.9% SLA", "On-premise option"],
  },
];

export default function BillingPage() {
  const { currentOrg } = useAuthStore();
  const currentPlan = currentOrg?.plan ?? "free";
  const [selectedPlan, setSelectedPlan] = useState(currentPlan);
  const [processing, setProcessing] = useState(false);

  const handleUpgrade = async (planId: string) => {
    if (planId === "enterprise") {
      window.open("mailto:sales@pointit.dev?subject=Enterprise%20Plan%20Inquiry", "_blank");
      return;
    }
    setProcessing(true);
    // In production, this would create a Stripe Checkout session
    // For now, just simulate the upgrade
    setTimeout(() => {
      setProcessing(false);
      alert(`Plan upgrade to ${planId} — Stripe integration coming soon!`);
    }, 1500);
  };

  return (
    <div>
      <AppHeader title="Billing" description="Manage your subscription plan" />

      <div className="p-8">
        <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link>

        {/* Current Plan */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Current Plan</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-slate-900 capitalize">{currentPlan}</span>
                  <Badge variant={currentPlan === "pro" ? "pro" : currentPlan === "enterprise" ? "enterprise" : "secondary"}>
                    Active
                  </Badge>
                </div>
              </div>
              {currentPlan !== "free" && (
                <div className="text-right">
                  <p className="text-sm text-slate-500">Next billing date</p>
                  <p className="text-sm font-medium text-slate-900">May 1, 2026</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plans Grid */}
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Available Plans</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const isUpgrade = PLANS.findIndex((p) => p.id === plan.id) > PLANS.findIndex((p) => p.id === currentPlan);
            return (
              <Card
                key={plan.id}
                className={`relative ${plan.popular ? "border-indigo-600 shadow-lg" : ""} ${isCurrent ? "ring-2 ring-indigo-200" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-0.5 text-xs font-semibold text-white">
                    Recommended
                  </div>
                )}
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl ${plan.color} flex items-center justify-center mb-4`}>
                    <plan.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                  <div className="mt-2 mb-4">
                    <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                    <span className="text-sm text-slate-500 ml-1">/{plan.period}</span>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                        <Check className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>Current Plan</Button>
                  ) : isUpgrade ? (
                    <Button
                      className="w-full"
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={processing}
                    >
                      {processing ? "Processing..." : plan.id === "enterprise" ? "Contact Sales" : "Upgrade"}
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>Downgrade</Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ */}
        <Card className="mt-8">
          <CardHeader><CardTitle>Billing FAQ</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-slate-900">How does per-seat billing work?</h4>
              <p className="text-sm text-slate-500 mt-1">You're charged based on the number of active members in your organization each month. Observers are free.</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-900">Can I cancel anytime?</h4>
              <p className="text-sm text-slate-500 mt-1">Yes. Cancel anytime and your plan reverts to Free at the end of the billing period. No data is deleted.</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-900">What payment methods do you accept?</h4>
              <p className="text-sm text-slate-500 mt-1">We accept all major credit cards via Stripe. Enterprise customers can pay by invoice.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}