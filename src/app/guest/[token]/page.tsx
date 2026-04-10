"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Mail, Play, AlertCircle } from "lucide-react";

interface SessionInfo {
  session_id: string;
  session_name: string;
  team_name: string;
  status: string;
  card_deck: string;
  join_token: string;
}

export default function GuestJoinPage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const supabase = createClient();

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    fetchSessionInfo();
  }, [token]);

  const fetchSessionInfo = async () => {
    setLoadingSession(true);
    try {
      const { data, error } = await supabase.rpc("get_session_by_join_token", {
        p_join_token: token,
      });
      if (error || !data) {
        setLoadError("Session not found or the link has expired.");
      } else if (data.error) {
        setLoadError(data.error);
      } else {
        setSessionInfo(data as SessionInfo);
      }
    } catch {
      setLoadError("Unable to load session. Please check the link.");
    }
    setLoadingSession(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setJoinError("Please enter a valid org email address.");
      return;
    }

    setJoining(true);
    setJoinError(null);

    try {
      const { data, error } = await supabase.rpc("join_session_as_guest", {
        p_join_token: token,
        p_email: email.trim().toLowerCase(),
      });

      if (error || !data) {
        setJoinError("Failed to join the session. Please try again.");
        setJoining(false);
        return;
      }

      if (data.error) {
        setJoinError(data.error);
        setJoining(false);
        return;
      }

      // Persist guest identity in sessionStorage so the room page can use it
      sessionStorage.setItem(
        `guest:${data.session_id}`,
        JSON.stringify({
          guest_id:     data.guest_id,
          guest_token:  data.guest_token,
          session_id:   data.session_id,
          session_name: data.session_name,
          card_deck:    data.card_deck,
          display_name: data.display_name,
          email:        data.email,
          join_token:   token,
        })
      );

      router.push(`/guest/${token}/room`);
    } catch {
      setJoinError("Unexpected error. Please try again.");
      setJoining(false);
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loadingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-slate-500">Loading session…</p>
        </div>
      </div>
    );
  }

  // ─── Error / not found ──────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-10">
            <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Can't join session</h2>
            <p className="text-slate-500">{loadError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Join form ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* PointIt logo / brand */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Play className="h-7 w-7 text-white" />
          </div>
          <p className="text-sm font-medium text-indigo-600 uppercase tracking-widest">PointIt</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardContent className="p-8">
            {/* Session info */}
            <div className="text-center mb-8">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                You're invited to
              </p>
              <h1 className="text-2xl font-bold text-slate-900">{sessionInfo?.session_name}</h1>
              {sessionInfo?.team_name && (
                <p className="text-sm text-slate-500 mt-1">{sessionInfo.team_name}</p>
              )}
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-emerald-700">Session is live</span>
              </div>
            </div>

            {/* Email form */}
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Enter your org email to join
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setJoinError(null); }}
                    className="pl-10 text-base"
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  No account or password needed — just your org email.
                </p>
              </div>

              {joinError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  {joinError}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
                disabled={joining || !email}
              >
                {joining ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Joining…</>
                ) : (
                  <><Play className="h-4 w-4 mr-2" /> Join Session</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          Powered by <span className="font-semibold text-slate-500">PointIt</span>
        </p>
      </div>
    </div>
  );
}
