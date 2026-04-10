"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spade } from "lucide-react";

export default function JoinSessionPage() {
  const params = useParams();
  const code = (params.code as string).toUpperCase();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState("");
  const supabase = createClient();

  useEffect(() => {
    checkSession();
  }, [code]);

  const checkSession = async () => {
    const { data } = await supabase
      .from("sessions")
      .select("id, name, status, teams(name)")
      .eq("join_code", code)
      .eq("status", "active")
      .single();

    if (data) {
      setSession(data);

      // If user is already logged in, check if they're already a member
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setDisplayName(user.user_metadata?.full_name || user.email?.split("@")[0] || "");
      }
    } else {
      setError("Session not found or has ended.");
    }
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!session) return;

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Authenticated user — go directly to session
      router.push(`/session/${session.id}`);
    } else {
      // Observer mode — redirect to login with return URL
      router.push(`/login?next=/session/${session.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400">Finding session...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white mx-auto mb-6">
          <Spade className="h-7 w-7" />
        </div>

        {error ? (
          <>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Session Not Found</h1>
            <p className="text-slate-500 mb-6">{error}</p>
            <Link href="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Join Session</h1>
            <p className="text-slate-500 mb-6">
              You&apos;re joining <strong className="text-slate-700">{session.name}</strong>
              {session.teams?.name && <> ({session.teams.name})</>}
            </p>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <div className="mb-6">
                <div className="text-3xl font-mono tracking-[0.3em] text-indigo-600 font-bold">{code}</div>
              </div>
              <div className="space-y-4">
                <div className="text-left">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Your display name</label>
                  <Input
                    placeholder="Jane Doe"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={handleJoin} disabled={!displayName}>
                  Join Session
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
