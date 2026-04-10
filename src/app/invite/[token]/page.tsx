"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, Users } from "lucide-react";

type State = "loading" | "ready" | "claiming" | "success" | "error" | "unauthenticated";

interface InviteInfo {
  org_name: string;
  role: string;
  invited_by_name: string | null;
  expires_at: string;
}

export default function InvitePage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const supabase = createClient();

  const [state, setState] = useState<State>("loading");
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    checkAuth();
  }, [token]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Not logged in — send to login with returnTo so they come back here after auth
      setState("unauthenticated");
      return;
    }

    // Authenticated — load invite details
    await loadInvite();
  };

  const loadInvite = async () => {
    setState("loading");
    const { data, error } = await supabase
      .from("org_invites")
      .select(`
        role,
        expires_at,
        claimed_at,
        organizations ( name ),
        invited_by_member:org_members!org_invites_invited_by_fkey ( display_name )
      `)
      .eq("token", token)
      .single();

    if (error || !data) {
      setErrorMsg("This invite link is invalid or has expired.");
      setState("error");
      return;
    }

    if (data.claimed_at) {
      setErrorMsg("This invite has already been used.");
      setState("error");
      return;
    }

    if (new Date(data.expires_at) < new Date()) {
      setErrorMsg("This invite link has expired. Ask an admin to send a new one.");
      setState("error");
      return;
    }

    setInvite({
      org_name: (data.organizations as any)?.name ?? "the organization",
      role: data.role,
      invited_by_name: (data.invited_by_member as any)?.display_name ?? null,
      expires_at: data.expires_at,
    });
    setState("ready");
  };

  const handleAccept = async () => {
    setState("claiming");
    const { data, error } = await supabase.rpc("claim_org_invite", { p_token: token });

    if (error || data?.error) {
      setErrorMsg(data?.error ?? error?.message ?? "Failed to accept invite.");
      setState("error");
      return;
    }

    setState("success");
    // Give a moment to show the success state, then navigate to dashboard
    setTimeout(() => router.push("/dashboard"), 2000);
  };

  const roleLabel = (role: string) => {
    const map: Record<string, string> = {
      admin: "Admin",
      scrum_master: "Scrum Master",
      member: "Member",
      observer: "Observer",
    };
    return map[role] ?? role;
  };

  const roleDesc = (role: string) => {
    const map: Record<string, string> = {
      admin: "Full access including billing and member management",
      scrum_master: "Can create and manage planning sessions",
      member: "Can join and vote in planning sessions",
      observer: "Can watch sessions without voting",
    };
    return map[role] ?? "";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-lg">P</div>
            <span className="text-2xl font-bold text-slate-900">Point<span className="text-indigo-600">It</span></span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">

          {/* Loading */}
          {state === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <p>Loading invite…</p>
            </div>
          )}

          {/* Not authenticated */}
          {state === "unauthenticated" && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-14 w-14 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Users className="h-7 w-7 text-indigo-600" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-slate-900">You've been invited!</h2>
              <p className="text-slate-500 text-sm">Sign in or create an account to accept this invitation and join the team.</p>
              <div className="flex flex-col gap-2 pt-2">
                <Link href={`/login?returnTo=/invite/${token}`}>
                  <Button className="w-full">Sign in to accept</Button>
                </Link>
                <Link href={`/signup?returnTo=/invite/${token}`}>
                  <Button variant="outline" className="w-full">Create account</Button>
                </Link>
              </div>
            </div>
          )}

          {/* Ready to accept */}
          {state === "ready" && invite && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="flex justify-center mb-3">
                  <div className="h-14 w-14 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Users className="h-7 w-7 text-indigo-600" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  {invite.invited_by_name
                    ? `${invite.invited_by_name} invited you`
                    : "You've been invited"}
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  to join <span className="font-semibold text-slate-700">{invite.org_name}</span>
                </p>
              </div>

              {/* Role card */}
              <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-5 py-4">
                <p className="text-xs font-medium text-indigo-500 uppercase tracking-wider mb-1">Your role</p>
                <p className="text-base font-semibold text-slate-900">{roleLabel(invite.role)}</p>
                <p className="text-sm text-slate-500 mt-0.5">{roleDesc(invite.role)}</p>
              </div>

              <p className="text-xs text-slate-400 text-center">
                Expires {new Date(invite.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>

              <Button onClick={handleAccept} className="w-full">
                Accept Invitation
              </Button>
            </div>
          )}

          {/* Claiming */}
          {state === "claiming" && (
            <div className="flex flex-col items-center gap-3 py-6 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <p>Accepting invitation…</p>
            </div>
          )}

          {/* Success */}
          {state === "success" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <h2 className="text-lg font-bold text-slate-900">You're in!</h2>
              <p className="text-slate-500 text-sm">Welcome to the team. Redirecting to your dashboard…</p>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <AlertCircle className="h-12 w-12 text-red-400" />
              <h2 className="text-lg font-bold text-slate-900">Invite unavailable</h2>
              <p className="text-slate-500 text-sm">{errorMsg}</p>
              <Link href="/dashboard">
                <Button variant="outline" className="mt-2">Go to Dashboard</Button>
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
