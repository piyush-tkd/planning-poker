"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { useSessionStore } from "@/store/session-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Play, Eye, EyeOff, SkipForward, Plus, Copy, Check, Users, Clock, X,
  ChevronLeft, ChevronRight, RefreshCw, BarChart3, ArrowLeft, Share2, Timer,
  Search, Loader2, ExternalLink, Upload, Link2, Crown, Download, RotateCcw
} from "lucide-react";

/* ── BSA send-back note panel (reused in Jira + non-Jira flows) ── */
function BsaNotePanel({
  bsaNote, setBsaNote, bsaSending, bsaError, onConfirm, onCancel,
}: {
  bsaNote: string;
  setBsaNote: (v: string) => void;
  bsaSending: boolean;
  bsaError: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="w-full max-w-sm space-y-2">
      <p className="text-xs text-slate-500 text-center">
        Mark this story as needing BSA clarification before it can be estimated.
      </p>
      <input
        type="text"
        placeholder="What needs clarification? (optional)"
        value={bsaNote}
        onChange={(e) => setBsaNote(e.target.value)}
        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
      />
      <div className="flex gap-2 justify-center">
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          disabled={bsaSending}
          onClick={onConfirm}
          className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1"
        >
          {bsaSending && <Loader2 className="h-3 w-3 animate-spin" />}
          <RotateCcw className="h-3 w-3" /> Send to BSA
        </button>
      </div>
      {bsaError && <p className="text-xs text-red-500 text-center">{bsaError}</p>}
    </div>
  );
}
import { FIBONACCI, T_SHIRT, PLAN_LIMITS, stripJiraMarkup } from "@/lib/utils";

export default function VotingRoomPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const router = useRouter();
  const { user, membership, currentOrg } = useAuthStore();
  const {
    session, stories, currentStoryIndex, votes, participants,
    setSession, setStories, setCurrentStoryIndex, addVote, setVotes,
    setParticipants, updateParticipantVoteStatus, currentStory, reset,
  } = useSessionStore();

  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showStorySidebar, setShowStorySidebar] = useState(false); // mobile toggle
  const [showAddStory, setShowAddStory] = useState(false);
  const [addMode, setAddMode] = useState<"manual" | "jira">("manual");
  const [newStoryTitle, setNewStoryTitle] = useState("");
  const [newStoryDesc, setNewStoryDesc] = useState("");
  const [newJiraKey, setNewJiraKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Jira integration state
  const [jiraConnected, setJiraConnected] = useState(false);
  const [jiraBoards, setJiraBoards] = useState<any[]>([]);
  const [jiraSprints, setJiraSprints] = useState<any[]>([]);
  const [jiraIssues, setJiraIssues] = useState<any[]>([]);
  const [selectedBoard, setSelectedBoard] = useState("");
  const [boardSearchText, setBoardSearchText] = useState("");
  const [showBoardDropdown, setShowBoardDropdown] = useState(false);
  const [selectedSprint, setSelectedSprint] = useState("");
  const [jiraSearchQuery, setJiraSearchQuery] = useState("");
  const [jiraLoading, setJiraLoading] = useState(false);
  const [selectedJiraIssues, setSelectedJiraIssues] = useState<Set<string>>(new Set());
  const [exportingCSV, setExportingCSV] = useState(false);
  const [writingBack, setWritingBack] = useState<string | null>(null);
  const [syncedStories, setSyncedStories] = useState<Set<string>>(new Set());
  const [syncError, setSyncError] = useState<string | null>(null);
  // Guest join state
  const [guestVotes, setGuestVotes] = useState<{ guest_id: string; display_name: string; email: string; vote: string }[]>([]);
  const [guestLinkCopied, setGuestLinkCopied] = useState(false);
  // No-consensus / no-time Jira comment state
  const [statusCommentSending, setStatusCommentSending] = useState(false);
  const [statusCommented, setStatusCommented] = useState<Set<string>>(new Set()); // jira keys
  const [statusCommentError, setStatusCommentError] = useState<string | null>(null);
  const [showSmNote, setShowSmNote] = useState<"no_consensus" | "no_time" | null>(null);
  const [smNote, setSmNote] = useState("");
  // Send-back to BSA state
  const [showBsaNote, setShowBsaNote] = useState(false);
  const [bsaNote, setBsaNote] = useState("");
  const [bsaSending, setBsaSending] = useState(false);
  const [bsaError, setBsaError] = useState<string | null>(null);
  // Observer comments
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  // Timer state
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [defaultTimerSeconds, setDefaultTimerSeconds] = useState(120); // 2 min auto-start default
  const timerEndsAtRef = useRef<string | null>(null);
  const timerChannelRef = useRef<any>(null);
  const timerAutoStartedRef = useRef<Set<number>>(new Set()); // track which story indices got auto-started

  const supabase = createClient();
  const role = membership?.role ?? "member";
  const isSM = role === "admin" || role === "scrum_master";
  const story = currentStory();
  const plan = (currentOrg?.plan ?? "free") as keyof typeof PLAN_LIMITS;
  const hasGuestJoin = PLAN_LIMITS[plan].guestJoin;

  // Load session data
  useEffect(() => {
    loadSession();
    checkJiraConnection();
    loadComments();
    return () => { reset(); };
  }, [sessionId]);

  // Subscribe to realtime
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel(`session:${sessionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "votes", filter: `story_id=eq.${story?.id}` },
        (payload) => {
          const vote = payload.new as any;
          addVote(vote.story_id, vote);
          updateParticipantVoteStatus(vote.user_id, true);
        }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "stories", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const updated = payload.new as any;
          setStories(stories.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
          if (updated.vote_status === "revealed") setShowResults(true);
        }
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stories", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          setStories([...stories, payload.new as any]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session, story?.id, stories]);

  // ── Realtime: comments ──────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`comments:${sessionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "story_comments", filter: `session_id=eq.${sessionId}` },
        (payload) => setComments((prev) => [...prev, payload.new])
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "story_comments", filter: `session_id=eq.${sessionId}` },
        (payload) => setComments((prev) => prev.filter((c) => c.id !== payload.old.id))
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  // ── Timer broadcast channel (stable — lives for the whole session) ──
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`timer:${sessionId}`)
      .on("broadcast", { event: "timer" }, ({ payload }: any) => {
        if (payload.action === "start") {
          timerEndsAtRef.current = payload.endsAt;
          const remaining = Math.max(0, Math.round((new Date(payload.endsAt).getTime() - Date.now()) / 1000));
          setTimerSeconds(remaining);
          setTimerActive(true);
        } else if (payload.action === "stop") {
          timerEndsAtRef.current = null;
          setTimerActive(false);
          setTimerSeconds(0);
        }
      })
      .subscribe();
    timerChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  // ── Auto-start timer on first story once session + channel are ready ──
  useEffect(() => {
    if (!session || !isSM || loading) return;
    if (story?.vote_status === "revealed") return;
    if (timerAutoStartedRef.current.has(currentStoryIndex)) return;
    // Small delay to ensure timer channel is subscribed
    const t = setTimeout(() => {
      timerAutoStartedRef.current.add(currentStoryIndex);
      startTimer(defaultTimerSeconds, false);
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, loading]);

  // ── Timer countdown tick ──────────────────────────────────────
  useEffect(() => {
    if (!timerActive || !timerEndsAtRef.current) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((new Date(timerEndsAtRef.current!).getTime() - Date.now()) / 1000));
      setTimerSeconds(remaining);
      if (remaining <= 0) {
        setTimerActive(false);
        clearInterval(interval);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [timerActive]);

  const startTimer = (seconds: number, saveAsDefault = true) => {
    const endsAt = new Date(Date.now() + seconds * 1000).toISOString();
    timerEndsAtRef.current = endsAt;
    setTimerSeconds(seconds);
    setTimerActive(true);
    setShowTimerPicker(false);
    if (saveAsDefault) setDefaultTimerSeconds(seconds);
    timerChannelRef.current?.send({ type: "broadcast", event: "timer", payload: { action: "start", endsAt } });
  };

  const stopTimer = () => {
    timerEndsAtRef.current = null;
    setTimerActive(false);
    setTimerSeconds(0);
    timerChannelRef.current?.send({ type: "broadcast", event: "timer", payload: { action: "stop" } });
  };

  const loadComments = async () => {
    const { data } = await supabase
      .from("story_comments")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (data) setComments(data);
  };

  const submitComment = async () => {
    if (!newComment.trim() || !story || !user) return;
    setSubmittingComment(true);
    const { error } = await supabase.from("story_comments").insert({
      session_id: sessionId,
      story_id: story.id,
      user_id: user.id,
      author_name: user.name || user.email?.split("@")[0] || "Unknown",
      content: newComment.trim(),
    });
    if (!error) setNewComment("");
    setSubmittingComment(false);
  };

  const loadSession = async () => {
    const { data, error: rpcError } = await supabase.rpc("get_session_data", {
      p_session_id: sessionId,
    });

    if (rpcError || !data) {
      console.error("Load session error:", rpcError);
      setError(rpcError?.message || "Failed to load session. Please refresh.");
      setLoading(false);
      return;
    }

    if (data.session) {
      // Draft sessions should go to the preview page, not the voting room
      if (data.session.status === "draft") {
        router.replace(`/session/${sessionId}/preview`);
        return;
      }
      setSession(data.session);
      const loadedStories = data.stories || [];
      setStories(loadedStories);

      // Load votes for any stories that are already revealed
      // (handles page reload mid-session or joining after reveal)
      const revealedStories = loadedStories.filter((s: any) => s.vote_status === "revealed");
      for (const s of revealedStories) {
        const { data: rawVotes } = await supabase
          .from("votes")
          .select("id, value, user_id, story_id")
          .eq("story_id", s.id);

        if (rawVotes && rawVotes.length > 0) {
          const userIds = Array.from(new Set(rawVotes.map((v: any) => v.user_id as string)));
          const { data: members } = await supabase
            .from("org_members")
            .select("user_id, display_name")
            .in("user_id", userIds);
          const memberMap = new Map(members?.map((m: any) => [m.user_id, m.display_name]) || []);
          const votesWithNames = rawVotes.map((v: any) => ({
            ...v,
            display_name: memberMap.get(v.user_id) || "Participant",
          }));
          setVotes(s.id, votesWithNames);
        }
      }
    }
    setLoading(false);
  };

  const cardDeck = session?.card_deck === "tshirt" ? T_SHIRT : FIBONACCI;

  const handleVote = async (value: string) => {
    if (!story || !user || story.vote_status === "revealed") return;
    setSelectedCard(value);

    const { error } = await supabase.rpc("cast_vote", {
      p_story_id: story.id,
      p_value: value,
      p_display_name: user.name,
    });
    if (error) console.error("Vote error:", error);
  };

  const handleReveal = async () => {
    if (!story || !isSM) return;

    const { data: voteData, error } = await supabase.rpc("reveal_story", {
      p_story_id: story.id,
    });

    if (error) {
      console.error("Reveal error:", error);
      return;
    }

    setStories(stories.map((s) => (s.id === story.id ? { ...s, vote_status: "revealed" as const } : s)));
    if (voteData) setVotes(story.id, voteData);
    setShowResults(true);

    // Auto-set final estimate when there is consensus on a numeric value
    if (voteData && Array.isArray(voteData)) {
      const numericVals = (voteData as any[]).map((v) => v.value).filter((v: string) => !isNaN(Number(v)));
      if (numericVals.length > 0 && new Set(numericVals).size === 1) {
        const consensusVal = numericVals[0];
        await supabase.rpc("set_story_estimate", { p_story_id: story.id, p_estimate: consensusVal });
        setStories(stories.map((s) => s.id === story.id ? { ...s, vote_status: "revealed" as const, final_estimate: consensusVal } : s));
      }
    }

    // Also load guest votes for this story
    if (hasGuestJoin) {
      const { data: gv } = await supabase.rpc("get_guest_votes", { p_story_id: story.id });
      if (gv && Array.isArray(gv)) setGuestVotes(gv);
      else if (typeof gv === "string") { try { const parsed = JSON.parse(gv); if (Array.isArray(parsed)) setGuestVotes(parsed); } catch {} }
    }
  };

  const handleNextStory = () => {
    if (currentStoryIndex < stories.length - 1) {
      const nextIndex = currentStoryIndex + 1;
      setCurrentStoryIndex(nextIndex);
      setSelectedCard(null);
      setShowResults(false);
      setShowFullDesc(false);
      setGuestVotes([]);
      // Broadcast new current story to guests
      if (isSM && session && stories[nextIndex]) {
        supabase.rpc("set_current_story", { p_session_id: session.id, p_story_id: stories[nextIndex].id }).then(() => {});
      }
      // Auto-start timer for new story (SM only, if not already started for this index)
      if (isSM && !timerAutoStartedRef.current.has(nextIndex)) {
        timerAutoStartedRef.current.add(nextIndex);
        setTimeout(() => startTimer(defaultTimerSeconds, false), 300);
      }
    }
  };

  const handlePrevStory = () => {
    if (currentStoryIndex > 0) {
      const prevIndex = currentStoryIndex - 1;
      setCurrentStoryIndex(prevIndex);
      setSelectedCard(null);
      setShowResults(false);
      setGuestVotes([]);
      // Broadcast new current story to guests
      if (isSM && session && stories[prevIndex]) {
        supabase.rpc("set_current_story", { p_session_id: session.id, p_story_id: stories[prevIndex].id }).then(() => {});
      }
    }
  };

  const handleResetVotes = async () => {
    if (!story || !isSM) return;

    const { error } = await supabase.rpc("reset_story_votes", {
      p_story_id: story.id,
    });

    if (error) {
      console.error("Reset error:", error);
      return;
    }

    setStories(stories.map((s) => (s.id === story.id ? { ...s, vote_status: "voting" as const, final_estimate: null } : s)));
    setVotes(story.id, []);
    setSelectedCard(null);
    setShowResults(false);
    // Auto-restart timer for the re-vote
    if (isSM) setTimeout(() => startTimer(defaultTimerSeconds, false), 300);
  };

  const handleSetEstimate = async (value: string) => {
    if (!story || !isSM) return;

    const { error } = await supabase.rpc("set_story_estimate", {
      p_story_id: story.id,
      p_estimate: value,
    });

    if (error) {
      console.error("Estimate error:", error);
      return;
    }

    setStories(stories.map((s) => (s.id === story.id ? { ...s, final_estimate: value } : s)));

    // Remove synced status if estimate is changed after sync
    if (story.jira_key && syncedStories.has(story.jira_key)) {
      const next = new Set(syncedStories);
      next.delete(story.jira_key);
      setSyncedStories(next);
    }
  };

  const handleAddStory = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newStoryTitle || newJiraKey || "Untitled Story";
    setError(null);

    const { data: storyData, error: storyError } = await supabase.rpc("add_story", {
      p_session_id: sessionId,
      p_title: title,
      p_description: newStoryDesc || null,
      p_jira_key: newJiraKey || null,
      p_sequence: stories.length,
    });

    if (storyError) {
      setError(`Add story failed: ${storyError.message}`);
      return;
    }

    if (storyData) {
      setStories([...stories, storyData]);
    }
    setShowAddStory(false);
    setNewStoryTitle("");
    setNewStoryDesc("");
    setNewJiraKey("");
    setAddMode("manual");
  };

  const handleEndSession = async () => {
    if (!isSM) return;

    // Auto-comment on any Jira-linked stories that were skipped (no estimate, not already commented)
    if (jiraConnected) {
      const skipped = stories.filter(
        (s) => s.jira_key && !s.final_estimate && !statusCommented.has(s.jira_key)
      );
      for (const s of skipped) {
        try {
          await fetch("/api/jira/comment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ issueKey: s.jira_key, reason: "skipped" }),
          });
        } catch { /* best-effort — don't block session end */ }
      }
    }

    const { error } = await supabase.rpc("end_session", {
      p_session_id: sessionId,
    });

    if (error) console.error("End session error:", error);
    // router.refresh() clears the Next.js client-side cache so the
    // dashboard always fetches fresh session statuses after navigation
    router.refresh();
    router.push("/dashboard");
  };

  const exportSessionCSV = () => {
    setExportingCSV(true);
    const rows = [
      ["#", "Jira Key", "Story Title", "Final Estimate", "Status"],
      ...stories.map((s, i) => [
        String(i + 1),
        s.jira_key ?? "",
        s.title,
        s.final_estimate ?? "",
        s.vote_status,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(session?.name ?? "session").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportingCSV(false);
  };

  // Check if Jira is connected for this org
  const checkJiraConnection = async () => {
    try {
      const res = await fetch("/api/jira/boards");
      if (res.ok) {
        const data = await res.json();
        setJiraConnected(true);
        setJiraBoards(data.boards || []);
      } else {
        setJiraConnected(false);
      }
    } catch {
      setJiraConnected(false);
    }
  };

  // Load sprints for selected board
  const loadSprints = async (boardId: string) => {
    setSelectedBoard(boardId);
    setJiraLoading(true);
    setJiraSprints([]);
    setJiraIssues([]);
    setSelectedSprint("");
    try {
      const res = await fetch(`/api/jira/sprints?boardId=${boardId}`);
      if (res.ok) {
        const data = await res.json();
        setJiraSprints(data.sprints || []);
      }
    } catch (e) {
      console.error("Load sprints error:", e);
    }
    setJiraLoading(false);
  };

  // Load issues for selected sprint
  const loadSprintIssues = async (sprintId: string) => {
    setSelectedSprint(sprintId);
    setJiraSearchQuery("");
    setSelectedJiraIssues(new Set());
    setJiraLoading(true);
    setJiraIssues([]);
    try {
      const res = await fetch(`/api/jira/issues?sprintId=${sprintId}`);
      if (res.ok) {
        const data = await res.json();
        setJiraIssues(data.issues || []);
      }
    } catch (e) {
      console.error("Load issues error:", e);
    }
    setJiraLoading(false);
  };

  // Search Jira issues by JQL or text
  const searchJiraIssues = async () => {
    if (!jiraSearchQuery.trim()) return;
    setJiraLoading(true);
    setJiraIssues([]);
    try {
      const q = jiraSearchQuery.trim();
      // Check if it looks like a Jira key (e.g. CEP-3183, PV1-234)
      const isKey = /^[A-Z][A-Z0-9]+-\d+$/i.test(q);
      let jql: string;
      if (isKey) {
        // Search by exact key — don't filter by type so user can find any issue by key
        jql = `key = "${q.toUpperCase()}"`;
      } else {
        // Text search — only stories
        jql = `issuetype = Story AND summary ~ "${q}"`;
      }
      const res = await fetch(`/api/jira/issues?jql=${encodeURIComponent(jql)}`);
      if (res.ok) {
        const data = await res.json();
        setJiraIssues(data.issues || []);
      }
    } catch (e) {
      console.error("Search error:", e);
    }
    setJiraLoading(false);
  };

  // Toggle Jira issue selection
  const toggleJiraIssue = (key: string) => {
    const next = new Set(selectedJiraIssues);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelectedJiraIssues(next);
  };

  // Import selected Jira issues as stories
  const importJiraIssues = async () => {
    setJiraLoading(true);
    let seq = stories.length;
    const newStories: any[] = [];

    for (const issue of jiraIssues.filter((i) => selectedJiraIssues.has(i.key))) {
      const { data } = await supabase.rpc("add_story", {
        p_session_id: sessionId,
        p_title: issue.summary || issue.key,
        p_description: issue.description || null,
        p_jira_key: issue.key,
        p_sequence: seq++,
      });
      if (data) newStories.push(data);
    }

    if (newStories.length > 0) {
      setStories([...stories, ...newStories]);
    }
    setShowAddStory(false);
    setSelectedJiraIssues(new Set());
    setJiraIssues([]);
    setSelectedBoard("");
    setSelectedSprint("");
    setJiraSearchQuery("");
    setAddMode("manual");
    setJiraLoading(false);
  };

  // Send no-consensus / no-time comment to Jira
  const sendStatusComment = async (
    jiraKey: string,
    reason: "no_consensus" | "no_time",
    note?: string
  ) => {
    setStatusCommentSending(true);
    setStatusCommentError(null);
    try {
      const res = await fetch("/api/jira/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueKey: jiraKey, reason, smNote: note }),
      });
      if (res.ok) {
        setStatusCommented((prev) => new Set(prev).add(jiraKey));
        setShowSmNote(null);
        setSmNote("");
      } else {
        const data = await res.json();
        setStatusCommentError(data.error || "Failed to add comment");
      }
    } catch (e: any) {
      setStatusCommentError(e.message || "Network error");
    }
    setStatusCommentSending(false);
  };

  // Write estimate back to Jira
  const writeEstimateToJira = async (jiraKey: string, estimate: string) => {
    const points = Number(estimate);
    if (isNaN(points) || !jiraKey) return;
    setWritingBack(jiraKey);
    setSyncError(null);
    try {
      const res = await fetch("/api/jira/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueKey: jiraKey, storyPoints: points }),
      });
      if (res.ok) {
        setSyncedStories((prev) => new Set(prev).add(jiraKey));
      } else {
        const data = await res.json();
        console.error("Write-back failed:", data.error);
        setSyncError(`Sync failed: ${data.error}`);
      }
    } catch (e: any) {
      console.error("Write-back error:", e);
      setSyncError(`Sync failed: ${e.message || "Network error"}`);
    }
    setWritingBack(null);
  };

  // Mark story as sent back to BSA for clarification
  const handleSendBackToBsa = async () => {
    if (!story || !isSM) return;
    setBsaSending(true);
    setBsaError(null);
    const { error } = await supabase
      .from("stories")
      .update({ sent_back_to_bsa: true, bsa_note: bsaNote.trim() || null })
      .eq("id", story.id);
    if (error) {
      setBsaError(error.message);
      setBsaSending(false);
      return;
    }
    setStories(stories.map((s) =>
      s.id === story.id ? { ...s, sent_back_to_bsa: true, bsa_note: bsaNote.trim() || null } : s
    ));
    setShowBsaNote(false);
    setBsaNote("");
    setBsaSending(false);
  };

  const copyCode = () => {
    if (session?.join_code) {
      navigator.clipboard.writeText(session.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyGuestLink = () => {
    if (session?.join_token) {
      const url = `${window.location.origin}/guest/${session.join_token}`;
      navigator.clipboard.writeText(url);
      setGuestLinkCopied(true);
      setTimeout(() => setGuestLinkCopied(false), 2500);
    }
  };

  const storyVotes = story ? (votes[story.id] || []) : [];
  const voteValues = storyVotes.map((v) => v.value).filter((v) => !isNaN(Number(v)));
  const average = voteValues.length > 0 ? (voteValues.reduce((a, b) => a + Number(b), 0) / voteValues.length).toFixed(1) : "—";
  const consensus = voteValues.length > 0 && new Set(voteValues).size === 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Play className="h-8 w-8 text-indigo-600" />
          </div>
          <p className="text-slate-500">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-lg font-medium text-slate-900 mb-1">Session not found</p>
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          <Link href="/dashboard"><Button variant="outline">Back to Dashboard</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {/* Mobile: stories toggle button */}
          <button
            className="sm:hidden p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
            onClick={() => setShowStorySidebar((v) => !v)}
            title="Toggle stories"
          >
            <BarChart3 className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-900 truncate max-w-[120px] sm:max-w-none">{session.name}</h1>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Badge variant={session.status === "active" ? "default" : "secondary"} className="text-[10px]">
                {session.status}
              </Badge>
              {role === "observer" && (
                <Badge className="text-[10px] bg-slate-100 text-slate-500 border-slate-200 hidden sm:inline-flex">
                  👁 Observer
                </Badge>
              )}
              <button onClick={copyCode} className="hidden sm:flex items-center gap-1 hover:text-indigo-600 transition font-mono">
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {session.join_code}
              </button>
              {isSM && hasGuestJoin && session.join_token && (
                <button
                  onClick={copyGuestLink}
                  title="Copy guest join link (Enterprise)"
                  className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition"
                >
                  {guestLinkCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Link2 className="h-3 w-3" />}
                  <span className="text-[10px] font-medium">{guestLinkCopied ? "Copied!" : "Guest Link"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Badge variant="secondary" className="text-xs">
            <Users className="h-3 w-3 mr-1" /> {storyVotes.length + guestVotes.length}
            <span className="hidden sm:inline"> voted</span>
            {guestVotes.length > 0 && <span className="ml-1 text-violet-500 hidden sm:inline">({guestVotes.length} guest)</span>}
          </Badge>
          {isSM && stories.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportSessionCSV} disabled={exportingCSV} title="Export CSV" className="hidden sm:flex">
              <Download className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">Export</span>
            </Button>
          )}
          {isSM && session.status === "active" && (
            <Button variant="destructive" size="sm" onClick={handleEndSession} className="text-xs px-2 sm:px-3">
              <span className="hidden sm:inline">End Session</span>
              <span className="sm:hidden">End</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Story Sidebar — hidden on mobile, toggled by button; always visible on sm+ */}
        <div className={`
          ${showStorySidebar ? "flex" : "hidden"} sm:flex
          w-full sm:w-64 md:w-72 border-r border-slate-200 bg-white flex-shrink-0 flex-col
          absolute sm:relative inset-0 z-20 sm:z-auto
        `}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Stories ({stories.length})</h2>
            <div className="flex items-center gap-1">
              {isSM && (
                <button onClick={() => setShowAddStory(true)} className="p-1 rounded hover:bg-slate-100">
                  <Plus className="h-4 w-4 text-slate-500" />
                </button>
              )}
              {/* Mobile: close story panel */}
              <button
                className="sm:hidden p-1 rounded hover:bg-slate-100"
                onClick={() => setShowStorySidebar(false)}
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {stories.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                No stories added yet.
                {isSM && <button onClick={() => setShowAddStory(true)} className="block mt-2 text-indigo-600 font-medium">Add one</button>}
              </div>
            ) : (
              stories.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => { setCurrentStoryIndex(i); setSelectedCard(null); setShowResults(s.vote_status === "revealed"); }}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 transition ${
                    i === currentStoryIndex ? "bg-indigo-50 border-l-2 border-l-indigo-600" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      {s.jira_key && (
                        <span className={`text-xs font-mono font-semibold ${i === currentStoryIndex ? "text-indigo-500" : "text-slate-400"}`}>
                          {s.jira_key}
                        </span>
                      )}
                      <span className={`block text-sm font-medium truncate ${i === currentStoryIndex ? "text-indigo-700" : "text-slate-900"}`}>
                        {s.title}
                      </span>
                    </div>
                    {s.sent_back_to_bsa ? (
                      <Badge variant="secondary" className="text-[10px] ml-2 flex-shrink-0 bg-violet-100 text-violet-700 border-violet-200">↩ BSA</Badge>
                    ) : s.final_estimate ? (
                      <Badge variant="default" className="text-[10px] ml-2 flex-shrink-0">{s.final_estimate}</Badge>
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Voting Area */}
        <div className="flex-1 flex flex-col">
          {story ? (
            <>
              {/* Current Story */}
              <div className="px-6 pt-4 pb-4 border-b border-slate-200 bg-white">

                {/* ── Row 1: nav + title + action buttons (always on one line) ── */}
                <div className="flex items-start gap-3">
                  {/* Prev arrow */}
                  <button
                    onClick={handlePrevStory}
                    disabled={currentStoryIndex === 0}
                    className="mt-1 p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 flex-shrink-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {/* Story meta + title */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      {/* Left: counter + status */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-slate-400">Story {currentStoryIndex + 1} of {stories.length}</span>
                        <Badge variant={story.vote_status === "revealed" ? "secondary" : "default"} className="text-[10px]">
                          {story.vote_status === "revealed" ? "Revealed" : "Voting"}
                        </Badge>
                      </div>

                      {/* Right: SM action buttons — pinned to top-right of title row */}
                      {isSM && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {story.vote_status !== "revealed" ? (
                            <>
                              {/* Timer controls */}
                              {timerActive ? (
                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold border
                                  ${timerSeconds <= 10
                                    ? "bg-red-100 text-red-700 border-red-200 animate-timer-pulse"
                                    : timerSeconds <= 30
                                    ? "bg-amber-100 text-amber-700 border-amber-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                  }`}>
                                  <Timer className="h-3 w-3" />
                                  {Math.floor(timerSeconds / 60)}:{String(timerSeconds % 60).padStart(2, "0")}
                                  <button onClick={stopTimer} className="ml-1 opacity-60 hover:opacity-100">
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="relative">
                                  <button
                                    onClick={() => setShowTimerPicker(!showTimerPicker)}
                                    className="h-8 px-2.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 flex items-center gap-1.5 text-xs transition"
                                    title={`Auto-starts at ${defaultTimerSeconds >= 60 ? `${defaultTimerSeconds / 60}m` : `${defaultTimerSeconds}s`} — click to change`}
                                  >
                                    <Timer className="h-3.5 w-3.5" />
                                    {defaultTimerSeconds >= 60 ? `${defaultTimerSeconds / 60}m` : `${defaultTimerSeconds}s`}
                                  </button>
                                  {showTimerPicker && (
                                    <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2 flex flex-col gap-0.5 min-w-[130px]">
                                      <p className="text-[10px] text-slate-400 px-3 pb-1 font-medium uppercase tracking-wide">Auto-start default</p>
                                      {[
                                        { label: "30 sec", s: 30 },
                                        { label: "1 min",  s: 60 },
                                        { label: "2 min",  s: 120 },
                                        { label: "5 min",  s: 300 },
                                      ].map(({ label, s }) => (
                                        <button key={s} onClick={() => startTimer(s)}
                                          className={`text-sm px-3 py-1.5 rounded-lg text-left transition flex items-center justify-between ${
                                            defaultTimerSeconds === s
                                              ? "bg-indigo-50 text-indigo-700 font-semibold"
                                              : "hover:bg-indigo-50 text-slate-700 hover:text-indigo-700"
                                          }`}>
                                          {label}
                                          {defaultTimerSeconds === s && <Check className="h-3 w-3" />}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                              <Button onClick={handleReveal} size="sm" className="h-8 px-3 text-xs">
                                <Eye className="h-3.5 w-3.5 mr-1" /> Reveal Cards
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                className="h-8 px-3 text-xs bg-amber-500 hover:bg-amber-600 text-white border-0"
                                onClick={handleResetVotes}
                              >
                                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Re-vote
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white border-0"
                                onClick={handleNextStory}
                                disabled={currentStoryIndex === stories.length - 1}
                              >
                                Next <SkipForward className="h-3.5 w-3.5 ml-1" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <h2 className="text-lg font-semibold text-slate-900 mt-1 leading-snug">{story.title}</h2>
                  </div>

                  {/* Next arrow */}
                  <button
                    onClick={handleNextStory}
                    disabled={currentStoryIndex === stories.length - 1}
                    className="mt-1 p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 flex-shrink-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* ── Row 2: description — full width, never pushes buttons ── */}
                {story.description && (() => {
                  const clean = stripJiraMarkup(story.description);
                  const lines = clean.split("\n").filter(Boolean);
                  const preview = lines.slice(0, 2).join(" ").slice(0, 220);
                  const isTruncated = clean.length > 220 || lines.length > 2;
                  return (
                    <div className="mt-2 pl-8 pr-8">
                      <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-line">
                        {showFullDesc ? clean : preview}
                        {!showFullDesc && isTruncated && "…"}
                      </p>
                      {isTruncated && (
                        <button
                          onClick={() => setShowFullDesc(!showFullDesc)}
                          className="text-xs text-indigo-500 hover:text-indigo-700 mt-1"
                        >
                          {showFullDesc ? "Show less" : "Show more"}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Voting Table / Results */}
              <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
                {showResults || story.vote_status === "revealed" ? (
                  /* Results View */
                  <div className="text-center w-full max-w-2xl">

                    {/* Big number */}
                    <div className="mb-6">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Results</p>
                      <div className={`text-7xl font-black leading-none ${consensus ? "text-emerald-600" : "gradient-text"}`}>
                        {voteValues.length > 0 ? (consensus ? voteValues[0] : average) : "—"}
                      </div>
                      {consensus && (
                        <p className="text-emerald-600 text-sm mt-3 font-semibold flex items-center justify-center gap-1.5">
                          🎉 Consensus!
                        </p>
                      )}
                      {!consensus && voteValues.length > 0 && (
                        <p className="text-slate-400 text-xs mt-2">Average · discuss outliers</p>
                      )}
                    </div>

                    {/* Vote distribution bar chart */}
                    {voteValues.length > 0 && (() => {
                      const counts: Record<string, number> = {};
                      voteValues.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
                      // Add non-numeric votes (?, ☕)
                      storyVotes.forEach((v) => { if (isNaN(Number(v.value))) { counts[v.value] = (counts[v.value] || 0) + 1; } });
                      guestVotes.forEach((gv) => { if (isNaN(Number(gv.vote))) { counts[gv.vote] = (counts[gv.vote] || 0) + 1; } });
                      const sorted = Object.entries(counts).sort(([a], [b]) => isNaN(Number(a)) ? 1 : isNaN(Number(b)) ? -1 : Number(a) - Number(b));
                      const maxCount = Math.max(...Object.values(counts));
                      const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0);
                      return (
                        <div className="mb-6 mx-auto max-w-xs space-y-2">
                          {sorted.map(([val, count], idx) => (
                            <div key={val} className="flex items-center gap-2 animate-fade-in-up" style={{ animationDelay: `${idx * 60}ms` }}>
                              <span className="w-8 text-right text-sm font-mono font-semibold text-slate-600 shrink-0">{val}</span>
                              <div className="flex-1 bg-slate-100 rounded-full h-7 overflow-hidden">
                                <div
                                  className={`h-7 rounded-full flex items-center pl-3 text-xs text-white font-semibold transition-all duration-700
                                    ${count === maxCount && consensus ? "bg-emerald-500" : count === maxCount ? "bg-indigo-500" : "bg-slate-300"}`}
                                  style={{ width: `${(count / maxCount) * 100}%`, minWidth: "2rem" }}
                                >
                                  {count}×
                                </div>
                              </div>
                              <span className="text-xs text-slate-400 w-8 shrink-0">{Math.round((count / totalVotes) * 100)}%</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Revealed vote cards — members */}
                    <div className="flex flex-wrap justify-center gap-4 mb-4">
                      {storyVotes.map((v, idx) => (
                        <div key={v.id} className="text-center animate-fade-in-up" style={{ animationDelay: `${idx * 50}ms` }}>
                          <div className="poker-card revealed mb-2 mx-auto">{v.value}</div>
                          <p className="text-xs text-slate-500 truncate max-w-[64px]">{v.display_name}</p>
                        </div>
                      ))}
                    </div>

                    {/* Guest vote cards */}
                    {guestVotes.length > 0 && (
                      <div className="mb-8">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-center gap-1">
                          <Users className="h-3 w-3" /> Guest votes
                        </p>
                        <div className="flex flex-wrap justify-center gap-4">
                          {guestVotes.map((gv) => (
                            <div key={gv.guest_id} className="text-center">
                              <div className="poker-card revealed mb-2 mx-auto ring-2 ring-violet-200">{gv.vote}</div>
                              <p className="text-xs text-violet-500 truncate max-w-[64px]">{gv.display_name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Final Estimate + Jira Sync */}
                    {isSM && (
                      <div className="space-y-4 w-full max-w-sm mx-auto">

                        {/* ── Primary Jira sync CTA (shown first when Jira-linked) ── */}
                        {story.jira_key && jiraConnected && (
                          <div className="flex flex-col items-center gap-2">
                            {writingBack === story.jira_key ? (
                              <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 text-slate-500 text-sm font-medium">
                                <Loader2 className="h-4 w-4 animate-spin" /> Syncing to Jira…
                              </div>
                            ) : syncedStories.has(story.jira_key) ? (
                              <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
                                <Check className="h-4 w-4" /> Synced {story.final_estimate} SP → {story.jira_key}
                              </div>
                            ) : (
                              <div className="w-full flex flex-col items-center gap-2">
                                <button
                                  disabled={!story.final_estimate}
                                  onClick={() => story.final_estimate && writeEstimateToJira(story.jira_key!, story.final_estimate)}
                                  className={`w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                                    story.final_estimate
                                      ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md"
                                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                  }`}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  {story.final_estimate
                                    ? `Push ${story.final_estimate} SP to Jira → ${story.jira_key}`
                                    : `Select estimate below, then push to ${story.jira_key}`}
                                </button>
                                {syncError && <span className="text-red-500 text-xs flex items-center gap-1"><X className="h-3 w-3" /> {syncError}</span>}
                              </div>
                            )}

                            {/* ── No consensus / No time / Send to BSA divider ── */}
                            {!syncedStories.has(story.jira_key) && !statusCommented.has(story.jira_key) && !story.sent_back_to_bsa && (
                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                <span className="text-xs text-slate-300">or</span>
                                <button
                                  onClick={() => setShowSmNote(showSmNote === "no_consensus" ? null : "no_consensus")}
                                  className="text-xs px-2.5 py-1 rounded-lg border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition"
                                >
                                  ⚠ No Consensus
                                </button>
                                <button
                                  onClick={() => setShowSmNote(showSmNote === "no_time" ? null : "no_time")}
                                  className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100 transition"
                                >
                                  ⏱ No Time
                                </button>
                                <button
                                  onClick={() => { setShowBsaNote((v) => !v); setShowSmNote(null); }}
                                  className="text-xs px-2.5 py-1 rounded-lg border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 transition"
                                >
                                  ↩ Send to BSA
                                </button>
                              </div>
                            )}

                            {/* ── SM note + confirm ── */}
                            {showSmNote && !statusCommented.has(story.jira_key) && (
                              <div className="w-full max-w-sm mt-1 space-y-2">
                                <p className="text-xs text-slate-500 text-center">
                                  {showSmNote === "no_consensus"
                                    ? "Jira comment: \"No consensus reached\" + your note below"
                                    : "Jira comment: \"Not estimated — ran out of time\" + your note below"}
                                </p>
                                <input
                                  type="text"
                                  placeholder="Optional SM note (e.g. needs AC clarification)…"
                                  value={smNote}
                                  onChange={(e) => setSmNote(e.target.value)}
                                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                />
                                <div className="flex gap-2 justify-center">
                                  <button
                                    onClick={() => { setShowSmNote(null); setSmNote(""); }}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    disabled={statusCommentSending}
                                    onClick={() => sendStatusComment(story.jira_key!, showSmNote, smNote)}
                                    className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {statusCommentSending && <Loader2 className="h-3 w-3 animate-spin" />}
                                    Post to Jira
                                  </button>
                                </div>
                                {statusCommentError && <p className="text-xs text-red-500 text-center">{statusCommentError}</p>}
                              </div>
                            )}

                            {/* ── Already commented ── */}
                            {statusCommented.has(story.jira_key) && (
                              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                                <Check className="h-3.5 w-3.5 text-emerald-500" /> Comment posted to {story.jira_key}
                              </span>
                            )}

                            {/* ── BSA send-back note (Jira stories) ── */}
                            {showBsaNote && !story.sent_back_to_bsa && (
                              <BsaNotePanel
                                bsaNote={bsaNote} setBsaNote={setBsaNote}
                                bsaSending={bsaSending} bsaError={bsaError}
                                onConfirm={handleSendBackToBsa}
                                onCancel={() => { setShowBsaNote(false); setBsaNote(""); }}
                              />
                            )}

                            {/* ── Already sent back ── */}
                            {story.sent_back_to_bsa && (
                              <span className="text-xs text-violet-600 flex items-center gap-1.5 font-medium">
                                <Check className="h-3.5 w-3.5" /> Sent back to BSA{story.bsa_note ? ` — "${story.bsa_note}"` : ""}
                              </span>
                            )}
                          </div>
                        )}

                        {/* ── Estimate picker (secondary — adjust the agreed value) ── */}
                        {!syncedStories.has(story.jira_key ?? "") && !statusCommented.has(story.jira_key ?? "") && !story.sent_back_to_bsa && (
                          <div className="flex flex-wrap items-center justify-center gap-1 bg-white rounded-xl border border-slate-100 p-2">
                            <span className="text-xs text-slate-400 mr-1 font-medium">
                              {story.final_estimate ? "Adjust:" : "Set estimate:"}
                            </span>
                            {cardDeck.filter((c) => c !== "?" && c !== "☕").map((c) => (
                              <button
                                key={c}
                                onClick={() => handleSetEstimate(c)}
                                className={`w-9 h-9 rounded-lg text-sm font-semibold transition ${
                                  story.final_estimate === c
                                    ? "bg-indigo-600 text-white ring-2 ring-indigo-300"
                                    : "bg-slate-100 text-slate-700 hover:bg-indigo-100"
                                }`}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* ── Send to BSA (non-Jira stories or without Jira connected) ── */}
                        {(!story.jira_key || !jiraConnected) && !story.sent_back_to_bsa && (
                          <div className="flex flex-col items-center gap-2">
                            {!showBsaNote ? (
                              <button
                                onClick={() => setShowBsaNote(true)}
                                className="text-xs px-3 py-1.5 rounded-lg border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 transition"
                              >
                                ↩ Send back to BSA
                              </button>
                            ) : (
                              <BsaNotePanel
                                bsaNote={bsaNote} setBsaNote={setBsaNote}
                                bsaSending={bsaSending} bsaError={bsaError}
                                onConfirm={handleSendBackToBsa}
                                onCancel={() => { setShowBsaNote(false); setBsaNote(""); }}
                              />
                            )}
                          </div>
                        )}

                        {/* ── Already sent back (non-Jira) ── */}
                        {(!story.jira_key || !jiraConnected) && story.sent_back_to_bsa && (
                          <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 text-sm font-medium">
                            <Check className="h-4 w-4 shrink-0" />
                            Sent back to BSA{story.bsa_note ? ` — "${story.bsa_note}"` : ""}
                          </div>
                        )}

                        {/* ── Decision confirmed + Next Story CTA ── */}
                        {story.final_estimate && (() => {
                          // Show when: no Jira key, OR Jira synced, OR Jira commented (no consensus / no time)
                          const jiraResolved = !story.jira_key || !jiraConnected
                            || syncedStories.has(story.jira_key ?? "")
                            || statusCommented.has(story.jira_key ?? "");
                          if (!jiraResolved) return null;
                          return (
                            <div className="mt-4 flex flex-col items-center gap-3 animate-fade-in-up">
                              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-sm">
                                <Check className="h-4 w-4 shrink-0" />
                                Decision: <span className="font-black">{story.final_estimate} SP</span> agreed
                              </div>
                              {currentStoryIndex < stories.length - 1 ? (
                                <Button
                                  onClick={handleNextStory}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                                >
                                  Next Story <SkipForward className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  onClick={handleEndSession}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                                >
                                  All done — End Session
                                </Button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Voting View */
                  <div className="text-center w-full max-w-2xl mx-auto">

                    {/* Timer countdown — visible to everyone */}
                    {timerActive && (
                      <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-mono font-bold mb-6 border-2 transition-all
                        ${timerSeconds <= 10
                          ? "bg-red-100 text-red-700 border-red-300 animate-timer-pulse"
                          : timerSeconds <= 30
                          ? "bg-amber-100 text-amber-700 border-amber-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                        <Timer className="h-4 w-4" />
                        <span className="text-base tabular-nums">
                          {Math.floor(timerSeconds / 60)}:{String(timerSeconds % 60).padStart(2, "0")}
                        </span>
                        {timerSeconds <= 10 && <span className="text-xs font-sans font-semibold ml-1">hurry!</span>}
                      </div>
                    )}

                    {/* Status line */}
                    <p className="text-sm text-slate-500 mb-4">
                      {selectedCard
                        ? <span className="text-emerald-600 font-medium">✓ You voted <strong>{selectedCard}</strong> — waiting for others</span>
                        : "Pick your estimate"}
                    </p>

                    {/* Face-down cards from other voters */}
                    {storyVotes.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-4 mb-10">
                        {storyVotes.map((v) => (
                          <div key={v.id} className="text-center animate-fade-in-up">
                            <div className="poker-card face-down mb-2 mx-auto">
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-8 h-10 rounded border border-white/20 bg-white/10" />
                              </div>
                            </div>
                            <p className="text-xs text-slate-400 truncate max-w-[64px]">{v.display_name}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Card deck selection */}
                    {role !== "observer" && (
                      <div className="flex flex-wrap justify-center gap-3">
                        {cardDeck.map((card) => (
                          <button
                            key={card}
                            onClick={() => handleVote(card)}
                            className={`poker-card ${selectedCard === card ? "selected" : ""}`}
                          >
                            {card === "☕" ? "☕" : card}
                          </button>
                        ))}
                      </div>
                    )}

                    {role === "observer" && (
                      <div className="mt-6 flex flex-col items-center gap-3">
                        <div className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600">
                          <EyeOff className="h-5 w-5 text-slate-400" />
                          <span className="text-sm font-medium">Observer Mode</span>
                        </div>
                        <p className="text-xs text-slate-400 text-center max-w-xs">
                          You&apos;re watching this session. Votes are hidden until the Scrum Master reveals them.
                          {storyVotes.length > 0 && ` ${storyVotes.length} ${storyVotes.length === 1 ? "person has" : "people have"} voted.`}
                        </p>
                      </div>
                    )}

                    {/* ── Comments panel (all roles, input for observers) ── */}
                    {story && (
                      <div className="mt-6 w-full max-w-lg mx-auto">
                        <button
                          onClick={() => setShowComments((v) => !v)}
                          className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 mb-2 transition"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.813 9.813 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                          {comments.filter(c => c.story_id === story.id).length > 0
                            ? `${comments.filter(c => c.story_id === story.id).length} note${comments.filter(c => c.story_id === story.id).length !== 1 ? "s" : ""}`
                            : "Add note"}
                          <span className="ml-auto">{showComments ? "▲" : "▼"}</span>
                        </button>

                        {showComments && (
                          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                            {/* Existing comments */}
                            <div className="max-h-40 overflow-y-auto">
                              {comments.filter(c => c.story_id === story.id).length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-4">No notes yet for this story.</p>
                              ) : (
                                comments.filter(c => c.story_id === story.id).map((c) => (
                                  <div key={c.id} className="px-3 py-2 border-b border-slate-100 last:border-0">
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="text-xs font-semibold text-slate-700">{c.author_name}</span>
                                      <span className="text-[10px] text-slate-400">{new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                      {c.user_id === user?.id && (
                                        <button onClick={() => supabase.from("story_comments").delete().eq("id", c.id)} className="ml-auto text-[10px] text-red-400 hover:text-red-600">×</button>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-600 mt-0.5">{c.content}</p>
                                  </div>
                                ))
                              )}
                            </div>
                            {/* Input — all roles can comment */}
                            <div className="flex gap-2 p-2 border-t border-slate-100 bg-slate-50">
                              <input
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                                placeholder="Add a note…"
                                maxLength={500}
                                className="flex-1 text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-300"
                              />
                              <button
                                onClick={submitComment}
                                disabled={!newComment.trim() || submittingComment}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 transition"
                              >
                                {submittingComment ? "…" : "Post"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Plus className="h-10 w-10 text-slate-300" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No stories to estimate</h3>
                <p className="text-slate-500 mb-4">Add stories to start voting.</p>
                {isSM && (
                  <Button onClick={() => setShowAddStory(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add Story
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Story Dialog */}
      <Dialog open={showAddStory} onOpenChange={(open) => { setShowAddStory(open); if (!open) { setError(null); setAddMode("manual"); } }}>
        <DialogContent className="max-w-xl flex flex-col gap-0 p-0 max-h-[88vh]">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b border-slate-100">
            <DialogTitle>Add Story</DialogTitle>
            <DialogDescription>Add a story to estimate by Jira ID or manually.</DialogDescription>
          </DialogHeader>

          {/* Mode Tabs */}
          <div className="px-6 pt-4 shrink-0">
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setAddMode("manual")}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition ${
                  addMode === "manual" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                ✏️ Manual Entry
              </button>
              <button
                type="button"
                onClick={() => setAddMode("jira")}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition ${
                  addMode === "jira" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                🔗 Pull from Jira
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {addMode === "jira" ? (
              <div className="space-y-3">
                {!jiraConnected ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-center">
                    <p className="text-sm text-amber-800 font-medium mb-1">Jira Not Connected</p>
                    <p className="text-xs text-amber-600 mb-3">Connect your Jira workspace in Settings &rarr; Integrations first.</p>
                    <Button size="sm" variant="outline" onClick={() => router.push("/settings/integrations")}>
                      <ExternalLink className="h-3 w-3 mr-1" /> Go to Integrations
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Step 1: Board & Sprint selection */}
                    <div className="flex gap-2">
                      {/* Searchable board dropdown */}
                      <div className="flex-1 relative">
                        <Input
                          placeholder="Search boards..."
                          value={boardSearchText}
                          onChange={(e) => {
                            setBoardSearchText(e.target.value);
                            setShowBoardDropdown(true);
                          }}
                          onFocus={() => setShowBoardDropdown(true)}
                          onBlur={() => setTimeout(() => setShowBoardDropdown(false), 200)}
                          className="text-sm w-full"
                        />
                        {showBoardDropdown && jiraBoards.length > 0 && (
                          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                            {jiraBoards
                              .filter((b: any) =>
                                b.name.toLowerCase().includes(boardSearchText.toLowerCase())
                              )
                              .map((b: any) => (
                                <button
                                  key={b.id}
                                  type="button"
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition ${
                                    selectedBoard === String(b.id) ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700"
                                  }`}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setSelectedBoard(String(b.id));
                                    setBoardSearchText(b.name);
                                    setShowBoardDropdown(false);
                                    loadSprints(String(b.id));
                                  }}
                                >
                                  {b.name}
                                </button>
                              ))}
                            {jiraBoards.filter((b: any) =>
                              b.name.toLowerCase().includes(boardSearchText.toLowerCase())
                            ).length === 0 && (
                              <div className="px-3 py-2 text-sm text-slate-400">No boards match</div>
                            )}
                          </div>
                        )}
                      </div>
                      <select
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                        value={selectedSprint}
                        onChange={(e) => e.target.value && loadSprintIssues(e.target.value)}
                        disabled={!selectedBoard || jiraSprints.length === 0}
                      >
                        <option value="">Select sprint...</option>
                        {jiraSprints.map((s: any) => (
                          <option key={s.id} value={s.id}>{s.name} ({s.state})</option>
                        ))}
                      </select>
                    </div>

                    {/* Loading state */}
                    {jiraLoading && (
                      <div className="flex items-center justify-center py-6 text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading issues...
                      </div>
                    )}

                    {/* Step 2: Filter bar — only shown after issues are loaded */}
                    {!jiraLoading && jiraIssues.length > 0 && (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          placeholder="Filter by key or title..."
                          value={jiraSearchQuery}
                          onChange={(e) => setJiraSearchQuery(e.target.value)}
                          className="pl-9 text-sm"
                        />
                      </div>
                    )}

                    {/* Issues list with client-side filtering */}
                    {!jiraLoading && jiraIssues.length > 0 && (() => {
                      const q = jiraSearchQuery.trim().toLowerCase();
                      const filtered = q
                        ? jiraIssues.filter((issue: any) =>
                            issue.key.toLowerCase().includes(q) ||
                            issue.summary.toLowerCase().includes(q)
                          )
                        : jiraIssues;
                      return (
                        <>
                          <div className="border border-slate-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-slate-100">
                            {filtered.length > 0 ? filtered.map((issue: any) => {
                              const alreadyImported = stories.some((s) => s.jira_key === issue.key);
                              return (
                                <label
                                  key={issue.key}
                                  className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition ${alreadyImported ? "opacity-50" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1 rounded border-slate-300"
                                    checked={selectedJiraIssues.has(issue.key)}
                                    onChange={() => toggleJiraIssue(issue.key)}
                                    disabled={alreadyImported}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-mono font-semibold text-indigo-600">{issue.key}</span>
                                      {issue.type && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{issue.type}</span>
                                      )}
                                      {issue.storyPoints != null && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600">{issue.storyPoints} SP</span>
                                      )}
                                      {alreadyImported && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-600">Already added</span>
                                      )}
                                    </div>
                                    <p className="text-sm text-slate-700 truncate">{issue.summary}</p>
                                  </div>
                                </label>
                              );
                            }) : (
                              <div className="text-center py-4 text-sm text-slate-400">No issues match &ldquo;{jiraSearchQuery}&rdquo;</div>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">{filtered.length} of {jiraIssues.length} stories</div>
                        </>
                      );
                    })()}

                    {!jiraLoading && jiraIssues.length === 0 && selectedSprint && (
                      <div className="text-center py-6 text-sm text-slate-400">No stories found in this sprint</div>
                    )}

                    {!jiraLoading && jiraIssues.length === 0 && !selectedSprint && (
                      <div className="text-center py-6 text-sm text-slate-400">Select a board and sprint to load stories</div>
                    )}

                    {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Jira Key <span className="text-slate-400 font-normal">(optional)</span></label>
                  <Input placeholder="PV1-234" value={newJiraKey} onChange={(e) => setNewJiraKey(e.target.value.toUpperCase())} className="font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <Input placeholder="Story title..." value={newStoryTitle} onChange={(e) => setNewStoryTitle(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description <span className="text-slate-400 font-normal">(optional)</span></label>
                  <Textarea placeholder="Acceptance criteria, context..." value={newStoryDesc} onChange={(e) => setNewStoryDesc(e.target.value)} rows={2} />
                </div>
                {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
              </div>
            )}
          </div>

          {/* Sticky action footer */}
          <div className="px-6 py-4 shrink-0 border-t border-slate-100 bg-white flex justify-between items-center gap-2">
            {addMode === "jira" ? (
              <>
                <span className="text-xs text-slate-400">
                  {selectedJiraIssues.size > 0 ? `${selectedJiraIssues.size} selected` : "Select issues to import"}
                </span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowAddStory(false)}>Cancel</Button>
                  <Button type="button" onClick={importJiraIssues} disabled={selectedJiraIssues.size === 0 || jiraLoading}>
                    <Upload className="h-4 w-4 mr-1" /> Import {selectedJiraIssues.size > 0 ? `(${selectedJiraIssues.size})` : ""}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={() => setShowAddStory(false)}>Cancel</Button>
                <Button type="button" onClick={handleAddStory} disabled={!newStoryTitle && !newJiraKey}>Add Story</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
