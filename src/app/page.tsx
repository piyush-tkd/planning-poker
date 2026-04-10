import Link from "next/link";
import { ArrowRight, Users, Zap, Shield, BarChart3, Puzzle, Globe } from "lucide-react";

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for small teams getting started",
    features: ["1 team", "Up to 10 members", "Unlimited sessions", "Fibonacci & T-Shirt decks", "Real-time voting", "Session history"],
    cta: "Get Started Free",
    popular: false,
  },
  {
    name: "Pro",
    price: "$4",
    period: "per user/month",
    description: "For teams that need more power",
    features: ["Up to 10 teams", "Up to 50 members", "Custom card decks", "Jira integration", "Advanced analytics", "Data export", "Priority support"],
    cta: "Start Pro Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "contact us",
    description: "For organizations at scale",
    features: ["Unlimited teams", "Unlimited members", "SSO / SAML", "Audit log", "Custom integrations", "Dedicated support", "SLA guarantee"],
    cta: "Contact Sales",
    popular: false,
  },
];

const FEATURES = [
  { icon: Zap, title: "Real-time Voting", description: "Cards appear face-down instantly. Reveal together to avoid anchoring bias." },
  { icon: Users, title: "Multi-tenant Teams", description: "Create your org, invite teams, manage roles. Everyone gets their own space." },
  { icon: Shield, title: "Anti-peek Protection", description: "Votes are hidden until the Scrum Master reveals. No peeking, no bias." },
  { icon: BarChart3, title: "Smart Analytics", description: "Track estimation accuracy, velocity trends, and team consensus over time." },
  { icon: Puzzle, title: "Jira Integration", description: "Pull stories directly from Jira. Write estimates back with one click." },
  { icon: Globe, title: "Join via Link", description: "Share a 6-digit code. Observers can join without an account." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm">P</div>
            <span className="text-xl font-bold text-slate-900">Point<span className="text-indigo-600">It</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition">Features</a>
            <a href="#how-it-works" className="hover:text-slate-900 transition">How it Works</a>
            <a href="#pricing" className="hover:text-slate-900 transition">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition">Log in</Link>
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition shadow-sm">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/50 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-8">
            <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
            Now in Public Beta
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-6">
            Sprint estimation,<br />
            <span className="gradient-text">dealt right.</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10">
            Real-time planning poker for modern engineering teams. Point stories together, reveal simultaneously, reach consensus faster.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-base font-medium text-white hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
              Start Free <ArrowRight className="h-5 w-5" />
            </Link>
            <a href="#how-it-works" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 transition">
              See How It Works
            </a>
          </div>

          {/* Floating poker cards decoration */}
          <div className="mt-16 flex items-center justify-center gap-4">
            {["1", "2", "3", "5", "8", "13", "?"].map((val, i) => (
              <div
                key={val}
                className="poker-card opacity-0 animate-fade-in-up"
                style={{ animationDelay: `${i * 100}ms`, animationFillMode: "forwards" }}
              >
                {val}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Everything your team needs</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">Built for engineering teams who care about estimation quality and team alignment.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-xl border border-slate-200 bg-white p-6 hover:shadow-lg hover:border-indigo-200 transition-all duration-300">
              <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-4 group-hover:bg-indigo-600 transition-colors">
                <f.icon className="h-6 w-6 text-indigo-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{f.title}</h3>
              <p className="text-slate-600">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">How it works</h2>
            <p className="text-lg text-slate-600">Three steps to better sprint estimates</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { step: "1", title: "Create a Session", desc: "Scrum Master starts a session and adds stories from the backlog or Jira." },
              { step: "2", title: "Vote Together", desc: "Everyone picks a card simultaneously. No peeking until the SM reveals." },
              { step: "3", title: "Reach Consensus", desc: "Discuss outliers, re-vote if needed, and lock in the final estimate." },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-6">
                  {s.step}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">{s.title}</h3>
                <p className="text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Simple, transparent pricing</h2>
          <p className="text-lg text-slate-600">Start free. Upgrade when you need more.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 flex flex-col ${
                plan.popular
                  ? "border-indigo-600 bg-white shadow-xl shadow-indigo-100 scale-105"
                  : "border-slate-200 bg-white hover:shadow-lg"
              } transition-all duration-300`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-1 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                <p className="text-sm text-slate-500 mt-1">{plan.description}</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                <span className="text-sm text-slate-500 ml-2">/{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-slate-600">
                    <svg className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`w-full text-center rounded-lg px-4 py-3 text-sm font-medium transition ${
                  plan.popular
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm">P</div>
              <span className="text-lg font-bold text-slate-900">Point<span className="text-indigo-600">It</span></span>
            </div>
            <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} PointIt. Built for teams that ship.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
