"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, Eye, Play, Loader2, AlertCircle, Coffee } from "lucide-react";
import { FIBONACCI, T_SHIRT } from "@/lib/utils";

interface GuestIdentity {
  guest_id: string;
  guest_token: string;
  session_id: string;
  session_name: string;
  card_deck: string;
  display_name: string;
  email: string;
  join_token: string;
}

interface Story {
  id: string;
  title: string;
  description: string | null;
  jira_key: string | null;
  vote_status: "voting" | "revealed";
  final_estimate: string | null;
  sequence: number;
}

interface SessionData {
  id: string;
  name: string;
  status: string;
  card_deck: string;
  current_story_id: string | null;
}

export default function GuestRoomPage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const supabase = createClient();

  const [identity, setIdentity] = useState<GuestIdentity | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [allStories, setAllStories] = useState<Story[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);

  // Redirect if no identity stored (they skipped the join page)
  useEffect(() => {
    const stored = sessionStorage.getItem(`guest:${token.replace("/room", "")}`);
    // The token param here is just the token portion without /room
    const rawToken = token;
    const key = `guest:${rawToken}`;
    const raw = sessionStorage.getItem(key);

    if (!raw) {
      router.replace(`/guest/${token}`);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as GuestIdentity;
      setIdentity(parsed);
    } catch {
      router.replace(`/guest/${token}`);
    }
  }, [token]);

  // Load session + stories once identity is set
  const loadSession = useCallback(async (guestIdentity: GuestIdentity) => {
    const { data, error: rpcError } = await supabase.rpc("get_session_data", {
      p_session_id: guestIdentity.session_id,
    });

    if (rpcError || !data) {
      setError("Could not load session data.");
      setLoading(false);
      return;
    }

    const sess = data.session as SessionData;
    const stories = (data.stories || []) as Story[];

    setSessionData(sess);
    setAllStories(stories);

    if (sess.status === "ended") {
      setSessionEnded(true);
      setLoading(false);
      return;
    }

    // Show the story the SM has set as current, or first unestimated story
    const active = sess.current_story_id
      ? stories.find((s) => s.id === sess.current_story_id) ?? null
      : stories.find((s) => s.vote_status === "voting") ?? stories[0] ?? null;

    setCurrentStory(active ?? null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (identity) loadSession(identity);
  }, [identity, loadSession]);

  // Reset vote state when story changes
  useEffect(() => {
    setSelectedCard(null);
    setHasVoted(false);
  }, [currentStory?.id]);

  // Realtime: watch session for story changes + session end
  useEffect(() => {
    if (!identity || !sessionData) return;

    const channel = supabase
      .channel(`guest-room:${identity.session_id}`)
      // SM changes current_story_id
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${identity.session_id}` },
        (payload) => {
          const updated = payload.new as SessionData;
          if (updated.status === "ended") {
            setSessionEnded(true);
            return;
          }
          setSessionData(updated);
          if (updated.current_story_id) {
            const story = allStories.find((s) => s.id === updated.current_story_id);
            if (story) setCurrentStory(story);
          }
        }
      )
      // Story vote_status changes (reveal/reset)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "stories", filter: `session_id=eq.${identity.session_id}` },
        (payload) => {
          const updated = payload.new as Story;
          setAllStories((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
          setCurrentStory((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
          // If the current story was reset, clear vote state
          if (updated.id === currentStory?.id && updated.vote_status === "voting") {
            setSelectedCard(null);
            setHasVoted(false);
          }
        }
      )
      // New story added
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stories", filter: `session_id=eq.${identity.session_id}` },
        (payload) => {
          const newStory = payload.new as Story;
          setAllStories((prev) => [...prev, newStory]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [identity, sessionData, allStories, currentStory?.id]);

  const handleVote = async (value: string) => {
    if (!identity || !currentStory || currentStory.vote_status === "revealed" || voting) return;

    setVoting(true);
    setSelectedCard(value);

    const { data, error: voteError } = await supabase.rpc("cast_guest_vote", {
      p_guest_token: identity.guest_token,
      p_session_id:  identity.session_id,
      p_story_id:    currentStory.id,
      p_vote:        value,
    });

    if (voteError || data?.error) {
      console.error("Vote error:", voteError || data?.error);
      setSelectedCard(null);
    } else {
      setHasVoted(true);
    }
    setVoting(false);
  };

  const cardDeck = (identity?.card_deck ?? sessionData?.card_deck) === "tshirt" ? T_SHIRT : FIBONACCI;

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-slate-500">Joining session…</p>
        </div>
      </div>
    );
  }

  // ─── Session ended ────────────────────────────────────────────────────────────
  if (sessionEnded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center shadow-xl border-0">
          <CardContent className="p-10">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Session ended</h2>
            <p className="text-slate-500">The Scrum Master has ended this session. Thanks for participating!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center shadow-xl border-0">
          <CardContent className="p-10">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
            <p className="text-slate-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isRevealed = currentStory?.vote_status === "revealed";

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-violet-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
            <Play className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{identity?.session_name ?? sessionData?.name}</p>
            <p className="text-xs text-slate-400">Joined as <span className="font-medium text-slate-600">{identity?.display_name}</span></p>
          </div>
        </div>
        <Badge variant="default" className="text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse inline-block" />
          Live
        </Badge>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">

        {/* Current Story Card */}
        {currentStory ? (
          <Card className="w-full max-w-xl shadow-lg border-0">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {currentStory.jira_key && (
                    <span className="text-xs font-mono font-semibold text-indigo-400 mb-1 block">
                      {currentStory.jira_key}
                    </span>
                  )}
                  <h2 className="text-lg font-semibold text-slate-900">{currentStory.title}</h2>
                  {currentStory.description && (
                    <p className="text-sm text-slate-500 mt-1 line-clamp-3">{currentStory.description}</p>
                  )}
                </div>
                <Badge variant={isRevealed ? "secondary" : "default"} className="flex-shrink-0">
                  {isRevealed ? "Revealed" : "Voting"}
                </Badge>
              </div>

              {/* Revealed state */}
              {isRevealed && currentStory.final_estimate && (
                <div className="mt-4 p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-center">
                  <p className="text-xs text-indigo-400 font-medium mb-1">Final Estimate</p>
                  <p className="text-3xl font-bold text-indigo-700">{currentStory.final_estimate} SP</p>
                </div>
              )}

              {isRevealed && !currentStory.final_estimate && (
                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-center text-sm text-slate-500">
                  Waiting for SM to set final estimate…
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-xl shadow-lg border-0">
            <CardContent className="p-8 text-center">
              <Clock className="h-8 w-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Waiting for the Scrum Master to start a story…</p>
            </CardContent>
          </Card>
        )}

        {/* Vote Status Banner */}
        {currentStory && !isRevealed && (
          <div className={`w-full max-w-xl rounded-xl border px-5 py-3 flex items-center gap-3 text-sm font-medium transition ${
            hasVoted
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-amber-50 border-amber-200 text-amber-700"
          }`}>
            {hasVoted ? (
              <><Check className="h-4 w-4" /> You voted <strong>{selectedCard}</strong> — waiting for others</>
            ) : (
              <><Clock className="h-4 w-4 animate-pulse" /> Pick a card below to cast your vote</>
            )}
          </div>
        )}

        {/* Card Deck */}
        {currentStory && !isRevealed && (
          <div className="w-full max-w-2xl">
            <div className="flex flex-wrap justify-center gap-3">
              {cardDeck.map((value) => {
                const isSelected = selectedCard === value;
                const isCoffee = value === "☕";
                return (
                  <button
                    key={value}
                    onClick={() => handleVote(value)}
                    disabled={voting}
                    className={`
                      relative w-16 h-24 rounded-xl border-2 text-lg font-bold transition-all duration-200
                      flex flex-col items-center justify-center shadow-sm select-none
                      ${isSelected
                        ? "border-indigo-500 bg-indigo-600 text-white shadow-indigo-200 shadow-lg scale-105 -translate-y-1"
                        : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5"
                      }
                      ${voting ? "opacity-60 cursor-not-allowed" : "cursor-pointer active:scale-95"}
                    `}
                  >
                    {isCoffee ? <Coffee className="h-6 w-6" /> : value}
                    {isSelected && (
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Revealed — no card needed */}
        {isRevealed && (
          <div className="text-center text-sm text-slate-400">
            <Eye className="h-5 w-5 mx-auto mb-2 opacity-40" />
            Cards are revealed. The SM will set the final estimate.
          </div>
        )}
      </div>
    </div>
  );
}
