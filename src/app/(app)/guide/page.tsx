"use client";
import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Crown, Users, UserCheck, Play, BookOpen, Zap, Settings, BarChart3,
  Shield, Link2, Calendar, Eye, MessageSquare, CheckCircle2,
  ChevronRight, ChevronDown, Spade, ArrowRight, Clock, Star
} from "lucide-react";

type RoleTab = "admin" | "scrum_master" | "member";

interface GuideSection {
  icon: React.ElementType;
  title: string;
  description: string;
  steps?: string[];
  tip?: string;
  badge?: string;
}

const ADMIN_SECTIONS: GuideSection[] = [
  {
    icon: Crown,
    title: "Setting Up Your Organization",
    description: "As an Admin, you own the workspace. Start by configuring the basics.",
    steps: [
      "Go to Settings → Organization to set your org name and plan.",
      "Invite Scrum Masters via Settings → Members — assign them the 'Scrum Master' role.",
      "Invite team members (developers, QA, etc.) — they get the 'Member' role by default.",
      "Create teams under the Teams page to group members by squad or project.",
    ],
    tip: "Each team can run independent sessions simultaneously.",
  },
  {
    icon: Link2,
    title: "Connecting Jira",
    description: "Connect your Jira Cloud instance to enable two-way story sync and automatic story point write-back.",
    steps: [
      "Go to Settings → Integrations.",
      "Enter your Jira Cloud URL (e.g. yourcompany.atlassian.net).",
      "Enter your Jira email and an API token (generate at id.atlassian.com → Security → API tokens).",
      "Click Connect — PointIt will verify the connection.",
      "Set your Story Points custom field (usually 'Story Points' or 'story_points'). Click Detect Fields to auto-discover.",
    ],
    tip: "Only Admins can connect Jira. Scrum Masters can use it once connected.",
    badge: "Required for Jira sync",
  },
  {
    icon: Shield,
    title: "Audit Log",
    description: "Track all activity across your organization — who changed what, and when.",
    steps: [
      "Navigate to Audit Log in the left sidebar.",
      "Filter by event type: Sessions, Stories, Members, Teams, Jira, Org.",
      "Search by description or actor name.",
      "Export to CSV for compliance or review.",
    ],
    tip: "Audit logs are retained for 30 days. A nightly job automatically purges older entries.",
    badge: "Enterprise",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Review team velocity, estimation accuracy, and session history.",
    steps: [
      "Navigate to Analytics in the left sidebar.",
      "View story point totals, consensus rates, and session summaries per team.",
      "Identify stories that consistently require re-voting — a sign of unclear requirements.",
    ],
    badge: "Pro+",
  },
  {
    icon: Settings,
    title: "Managing Plans & Billing",
    description: "Upgrade your plan to unlock more features for your organization.",
    steps: [
      "Go to Settings → Billing to view your current plan.",
      "Free: unlimited sessions, up to 3 teams, basic analytics.",
      "Pro: unlimited teams, advanced analytics, Jira integration.",
      "Enterprise: everything in Pro + Audit Log, SSO, priority support.",
    ],
  },
];

const SM_SECTIONS: GuideSection[] = [
  {
    icon: Play,
    title: "Starting a Session (Start Now)",
    description: "Kick off a live planning poker session your team joins instantly.",
    steps: [
      "From the Dashboard, click New Session → Start Now.",
      "Enter a session name (e.g. 'Sprint 25 Planning') and select a team.",
      "You're taken to the voting room immediately. Share the 6-character join code with your team.",
      "Add stories manually or import from Jira using the + Add Story button.",
      "For each story: team votes → you click Reveal → see all votes → set the final estimate → optionally sync to Jira.",
    ],
    tip: "Use 'Guest Link' to invite people outside your org (contractors, stakeholders). They enter their email to join.",
  },
  {
    icon: Calendar,
    title: "Planning a Session Ahead of Time",
    description: "Create draft sessions so your team can review stories before the meeting.",
    steps: [
      "From the Dashboard, click New Session → Plan Ahead.",
      "Enter a name, optional scheduled date, and optional description.",
      "You're taken to the session preview page — add all the stories your team will estimate.",
      "Copy the 'Share Preview' link and send it to your team. They can read the stories but can't vote yet.",
      "On the day of the session, click Start Session to go live.",
    ],
    tip: "Teams come more prepared when they've read the stories in advance. Expect fewer re-votes and shorter sessions.",
  },
  {
    icon: BookOpen,
    title: "Importing Stories from Jira",
    description: "Pull sprint or backlog stories directly from Jira into any session.",
    steps: [
      "Inside a session or preview page, click Add Story → Jira tab.",
      "Select a Board, then a Sprint (or Backlog).",
      "Stories appear in the list — check the ones you want to import.",
      "Click Add Selected. Stories are added to the session in sequence.",
      "Jira keys are linked automatically for write-back.",
    ],
    tip: "Use the search box to filter issues by key (e.g. PROJ-123) or keyword.",
  },
  {
    icon: CheckCircle2,
    title: "Syncing Estimates Back to Jira",
    description: "After a vote is revealed, write the agreed estimate directly to the Jira issue.",
    steps: [
      "Once votes are revealed, the Jira Sync panel appears.",
      "Select the final story point value.",
      "Click Sync to Jira — points are written and a comment is added automatically.",
      "The comment includes: 'Story refined on [date] CST and story points given X'.",
    ],
  },
  {
    icon: MessageSquare,
    title: "No Consensus & No Time Comments",
    description: "Handle stories that couldn't be estimated — log the reason in Jira without wasting points.",
    steps: [
      "If the team can't agree, click No Consensus in the Jira sync panel.",
      "If time runs out, click No Time.",
      "Optionally add an SM note (e.g. 'Need AC clarification').",
      "Click Post to Jira — a structured comment is added to the issue.",
      "When you end the session, any Jira stories that were never reached get a 'Skipped' comment automatically.",
    ],
    tip: "This keeps your Jira history clean and gives the next refinement session context.",
  },
  {
    icon: Users,
    title: "Managing Votes & Re-voting",
    description: "Control the session flow with reveal, re-vote, and navigation.",
    steps: [
      "Click Reveal to show all votes simultaneously.",
      "If there's a wide spread, discuss and click Re-vote to reset the round.",
      "Click Next to move to the following story, or use the arrow navigation.",
      "The vote counter badge shows how many people (including guests) have voted.",
    ],
  },
  {
    icon: Zap,
    title: "Ending a Session",
    description: "Wrap up and return to the dashboard when estimation is complete.",
    steps: [
      "Click End Session in the top bar.",
      "Any Jira-linked stories that weren't estimated receive a 'Skipped' comment automatically.",
      "You're redirected to the dashboard. The session appears in Recent Sessions with status 'ended'.",
    ],
  },
];

const MEMBER_SECTIONS: GuideSection[] = [
  {
    icon: Zap,
    title: "Joining a Live Session",
    description: "Jump into a planning poker session your Scrum Master has started.",
    steps: [
      "From the Dashboard, click Join Session or use the quick-join code field at the bottom.",
      "Enter the 6-character code shared by your Scrum Master.",
      "You're taken directly into the voting room.",
    ],
    tip: "If your SM shared a guest link (a URL), click it and enter your email — no account needed.",
  },
  {
    icon: Spade,
    title: "Casting Your Vote",
    description: "Estimate each story by selecting a card from the deck.",
    steps: [
      "Read the story title and description shown on screen.",
      "Click the card that represents your effort estimate (e.g. 3, 5, 8 on Fibonacci).",
      "Your card is submitted — wait for the SM to reveal all votes.",
      "If the reveal shows a wide spread, the SM may call a re-vote — just pick a new card.",
    ],
    tip: "Vote based on complexity and effort, not time. Fibonacci numbers encourage honest estimation.",
  },
  {
    icon: Eye,
    title: "Previewing Upcoming Sessions",
    description: "Review stories before a session starts so you come prepared.",
    steps: [
      "On the Dashboard, look for the Upcoming Sessions section.",
      "Click Preview on any draft session to see the list of stories.",
      "Read through the stories, check Jira keys, and come to the session ready to discuss.",
    ],
    tip: "Sessions you can preview are in 'Draft' status — the SM hasn't started them yet. You cannot vote until the session is live.",
  },
  {
    icon: BarChart3,
    title: "Reading the Vote Results",
    description: "Understand what the revealed votes mean and how consensus is reached.",
    steps: [
      "After reveal, everyone's vote is shown with their name.",
      "The average and distribution give the SM a guide.",
      "If most people agree, the SM sets the final estimate and syncs to Jira.",
      "If votes are spread (e.g. 3 vs. 13), discuss briefly and re-vote.",
    ],
  },
  {
    icon: Clock,
    title: "Viewing Your Teams & Sessions",
    description: "Stay up to date with your team's activity.",
    steps: [
      "The Dashboard shows all your teams and whether they have a live session running.",
      "Click a 'Live' badge to jump directly into that session.",
      "Recent Sessions lists past sessions — click any to view its stories and results.",
    ],
  },
];

const PLAN_FEATURES = [
  { feature: "Unlimited sessions", free: true, pro: true, enterprise: true },
  { feature: "Up to 3 teams", free: true, pro: false, enterprise: false },
  { feature: "Unlimited teams", free: false, pro: true, enterprise: true },
  { feature: "Jira integration", free: false, pro: true, enterprise: true },
  { feature: "Guest join links", free: true, pro: true, enterprise: true },
  { feature: "Pre-planned sessions", free: true, pro: true, enterprise: true },
  { feature: "Analytics", free: false, pro: true, enterprise: true },
  { feature: "Audit Log (30-day retention)", free: false, pro: false, enterprise: true },
  { feature: "Priority support", free: false, pro: false, enterprise: true },
];

function SectionCard({ section, defaultOpen = false }: { section: GuideSection; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = section.icon;

  return (
    <Card className={cn("transition-shadow", open ? "shadow-md" : "hover:shadow-sm")}>
      <button
        className="w-full text-left"
        onClick={() => setOpen(!open)}
      >
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-900">{section.title}</h3>
                {section.badge && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-violet-100 text-violet-700 border-violet-200">
                    {section.badge}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{section.description}</p>
            </div>
            <div className="shrink-0 mt-0.5">
              {open ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
            </div>
          </div>

          {open && (
            <div className="mt-4 pl-14 space-y-3" onClick={(e) => e.stopPropagation()}>
              {section.steps && (
                <ol className="space-y-2">
                  {section.steps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-semibold mt-0.5">
                        {idx + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              )}
              {section.tip && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <Star className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">{section.tip}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </button>
    </Card>
  );
}

export default function GuidePage() {
  const { membership, currentOrg } = useAuthStore();
  const role = membership?.role ?? "member";
  const isSM = role === "admin" || role === "scrum_master";
  const isAdmin = role === "admin";

  // Default tab based on user role
  const [activeTab, setActiveTab] = useState<RoleTab>(
    isAdmin ? "admin" : isSM ? "scrum_master" : "member"
  );

  const TABS: { id: RoleTab; label: string; icon: React.ElementType; description: string }[] = [
    { id: "admin", label: "Admin", icon: Crown, description: "Organization setup, Jira, billing, and audit" },
    { id: "scrum_master", label: "Scrum Master", icon: UserCheck, description: "Running sessions, importing stories, Jira sync" },
    { id: "member", label: "Team Member", icon: Users, description: "Joining sessions and casting votes" },
  ];

  const sections =
    activeTab === "admin" ? ADMIN_SECTIONS :
    activeTab === "scrum_master" ? SM_SECTIONS :
    MEMBER_SECTIONS;

  return (
    <div>
      <AppHeader
        title="User Guide"
        description="Everything you need to know about using PointIt"
      />

      <div className="p-8 max-w-4xl mx-auto space-y-8">
        {/* Quick start banner */}
        <Card className="bg-gradient-to-r from-indigo-600 to-violet-600 border-0">
          <CardContent className="p-6 flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Spade className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">Welcome to PointIt</h2>
              <p className="text-indigo-100 text-sm mt-1">
                Collaborative planning poker for agile teams. Estimate stories together, sync to Jira, and ship faster.
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-indigo-200 text-xs">Your plan</p>
              <p className="text-white font-semibold capitalize">{currentOrg?.plan ?? "Free"}</p>
            </div>
          </CardContent>
        </Card>

        {/* Role Tabs */}
        <div>
          <h2 className="text-base font-semibold text-slate-700 mb-3">Browse guide by role</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {TABS.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all",
                    isActive
                      ? "border-indigo-500 bg-indigo-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <TabIcon className={cn("h-4 w-4", isActive ? "text-indigo-600" : "text-slate-400")} />
                    <span className={cn("font-semibold text-sm", isActive ? "text-indigo-700" : "text-slate-700")}>{tab.label}</span>
                    {tab.id === role && (
                      <Badge className="text-[10px] px-1 py-0 bg-emerald-100 text-emerald-700 border-emerald-200 ml-auto">You</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{tab.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Guide Sections */}
        <div className="space-y-3">
          {sections.map((section, idx) => (
            <SectionCard key={section.title} section={section} defaultOpen={idx === 0} />
          ))}
        </div>

        {/* Plan Comparison */}
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Features by Plan
          </h2>
          <Card>
            <CardContent className="p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 font-medium text-slate-600">Feature</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Free</th>
                    <th className="text-center px-4 py-3 font-medium text-violet-700">Pro</th>
                    <th className="text-center px-4 py-3 font-medium text-indigo-700">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_FEATURES.map((row, idx) => (
                    <tr key={row.feature} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                      <td className="px-5 py-3 text-slate-700">{row.feature}</td>
                      <td className="px-4 py-3 text-center">
                        {row.free
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                          : <span className="text-slate-300 text-base">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.pro || row.free
                          ? <CheckCircle2 className="h-4 w-4 text-violet-500 mx-auto" />
                          : <span className="text-slate-300 text-base">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.enterprise || row.pro || row.free
                          ? <CheckCircle2 className="h-4 w-4 text-indigo-500 mx-auto" />
                          : <span className="text-slate-300 text-base">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Quick Tips */}
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-4">Quick Tips</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                icon: Calendar,
                title: "Plan sessions in advance",
                tip: "Use 'Plan Ahead' to create draft sessions. Share stories early so your team reads them before the meeting.",
              },
              {
                icon: MessageSquare,
                title: "Always log no-consensus",
                tip: "Use 'No Consensus' or 'No Time' buttons to add a Jira comment. This saves context for the next refinement.",
              },
              {
                icon: Link2,
                title: "Use Fibonacci, not hours",
                tip: "Fibonacci cards (1, 2, 3, 5, 8…) force honest relative estimation. Avoid mapping points to hours.",
              },
              {
                icon: Users,
                title: "Invite guests for context",
                tip: "Use the Guest Link to invite stakeholders or contractors. They vote normally without needing an account.",
              },
            ].map((tip) => {
              const TipIcon = tip.icon;
              return (
                <Card key={tip.title} className="bg-slate-50 border-slate-200">
                  <CardContent className="p-4 flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <TipIcon className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{tip.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{tip.tip}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
