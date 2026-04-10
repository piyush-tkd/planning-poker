"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Play, ArrowLeft, Plus, Trash2, GripVertical, Calendar, BookOpen,
  Copy, CheckCircle2, AlertCircle, Loader2, Users, Search, ExternalLink
} from "lucide-react";

interface SessionPreview {
  id: string;
  name: string;
  status: string;
  card_deck: string;
  scheduled_for: string | null;
  description: string | null;
  join_token: string | null;
}

interface StoryPreview {
  id: string;
  title: string;
  description: string | null;
  jira_key: string | null;
  sequence: number;
}

interface TeamPreview {
  id: string;
  name: string;
}

export default function SessionPreviewPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const { membership } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();
  const isSM = membership?.role === "admin" || membership?.role === "scrum_master";

  const [session, setSession] = useState<SessionPreview | null>(null);
  const [team, setTeam] = useState<TeamPreview | null>(null);
  const [stories, setStories] = useState<StoryPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Add story state
  const [showAddStory, setShowAddStory] = useState(false);
  const [addMode, setAddMode] = useState<"manual" | "jira">("manual");
  const [storyTitle, setStoryTitle] = useState("");
  const [storyDescription, setStoryDescription] = useState("");
  const [storyJiraKey, setStoryJiraKey] = useState("");
  const [addingStory, setAddingStory] = useState(false);
  const [addStoryError, setAddStoryError] = useState<string | null>(null);

  // Jira state
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

  // Delete story state
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null);

  useEffect(() => {
    loadPreview();
    checkJiraConnection();
  }, [sessionId]);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("get_session_preview", {
      p_session_id: sessionId,
    });

    if (rpcError || !data) {
      setError(rpcError?.message || "Session not found");
      setLoading(false);
      return;
    }

    if (data.error) {
      setError(data.error);
      setLoading(false);
      return;
    }

    setSession(data.session);
    setTeam(data.team);
    setStories(data.stories || []);
    setLoading(false);
  };

  const handleStartSession = async () => {
    if (!session) return;
    setStarting(true);
    setStartError(null);

    const { data, error: rpcError } = await supabase.rpc("start_session", {
      p_session_id: session.id,
    });

    if (rpcError || data?.error) {
      setStartError(rpcError?.message || data?.error || "Failed to start session");
      setStarting(false);
      return;
    }

    // Navigate to active session
    router.push(`/session/${session.id}`);
  };

  const handleAddStory = async () => {
    if (!session || !storyTitle.trim()) return;
    setAddingStory(true);
    setAddStoryError(null);

    const { data, error: rpcError } = await supabase.rpc("add_story", {
      p_session_id: session.id,
      p_title: storyTitle.trim(),
      p_description: storyDescription.trim() || null,
      p_jira_key: storyJiraKey.trim() || null,
    });

    if (rpcError || !data?.id) {
      setAddStoryError(rpcError?.message || "Failed to add story");
      setAddingStory(false);
      return;
    }

    // Refresh stories
    await loadPreview();
    setStoryTitle("");
    setStoryDescription("");
    setStoryJiraKey("");
    setShowAddStory(false);
    setAddingStory(false);
  };

  const handleDeleteStory = async (storyId: string) => {
    setDeletingStoryId(storyId);
    await supabase.from("stories").delete().eq("id", storyId);
    setStories((prev) => prev.filter((s) => s.id !== storyId));
    setDeletingStoryId(null);
  };

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
    } catch {}
    setJiraLoading(false);
  };

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
    } catch {}
    setJiraLoading(false);
  };

  const importJiraIssues = async () => {
    if (!session) return;
    setJiraLoading(true);
    let seq = stories.length;
    for (const issue of jiraIssues.filter((i) => selectedJiraIssues.has(i.key))) {
      await supabase.rpc("add_story", {
        p_session_id: session.id,
        p_title: issue.summary || issue.key,
        p_description: issue.description || null,
        p_jira_key: issue.key,
        p_sequence: seq++,
      });
    }
    await loadPreview();
    setShowAddStory(false);
    setSelectedJiraIssues(new Set());
    setJiraIssues([]);
    setSelectedBoard("");
    setBoardSearchText("");
    setSelectedSprint("");
    setJiraSearchQuery("");
    setAddMode("manual");
    setJiraLoading(false);
  };

  const copyPreviewLink = () => {
    if (!session?.join_token) return;
    navigator.clipboard.writeText(`${window.location.origin}/session/${session.id}/preview`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-slate-600">{error || "Session not found"}</p>
        <Link href="/dashboard"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button></Link>
      </div>
    );
  }

  // If the session is no longer draft (was started), redirect to it
  if (session.status === "active") {
    router.replace(`/session/${session.id}`);
    return null;
  }

  return (
    <div>
      <AppHeader
        title={session.name}
        description={team ? `${team.name} · Draft Session` : "Draft Session"}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Button>
            </Link>
            {isSM && session.join_token && (
              <Button variant="outline" size="sm" onClick={copyPreviewLink}>
                {copied ? <CheckCircle2 className="h-4 w-4 mr-1 text-emerald-600" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? "Copied!" : "Share Preview"}
              </Button>
            )}
            {isSM && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleStartSession}
                disabled={starting || stories.length === 0}
                title={stories.length === 0 ? "Add at least one story to start" : undefined}
              >
                {starting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                {starting ? "Starting..." : "Start Session"}
              </Button>
            )}
          </div>
        }
      />

      <div className="p-8 max-w-4xl mx-auto space-y-6">
        {/* Session Info Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200">Draft</Badge>
                  <span className="text-sm text-slate-500 capitalize">{session.card_deck} deck</span>
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-1">{session.name}</h2>
                {session.description && (
                  <p className="text-slate-600 text-sm mt-2">{session.description}</p>
                )}
                <div className="flex items-center gap-6 mt-4 text-sm text-slate-500">
                  {session.scheduled_for && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      Scheduled for {new Date(session.scheduled_for).toLocaleString("en-US", {
                        weekday: "short", month: "short", day: "numeric",
                        hour: "numeric", minute: "2-digit"
                      })}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4" />
                    {stories.length} {stories.length === 1 ? "story" : "stories"} planned
                  </span>
                </div>
              </div>
            </div>

            {startError && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {startError}
              </div>
            )}

            {isSM && stories.length === 0 && (
              <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
                Add stories below, then start the session when your team is ready.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stories Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              Stories for this Session
              <span className="ml-2 text-sm font-normal text-slate-500">({stories.length})</span>
            </h3>
            {isSM && (
              <Button size="sm" onClick={() => setShowAddStory(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Story
              </Button>
            )}
          </div>

          {stories.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <h4 className="text-slate-600 font-medium mb-1">No stories yet</h4>
                <p className="text-sm text-slate-400 mb-4">
                  {isSM
                    ? "Add the stories your team will estimate in this session."
                    : "The Scrum Master hasn't added any stories yet. Check back soon!"}
                </p>
                {isSM && (
                  <Button onClick={() => setShowAddStory(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add First Story
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {stories.map((story, idx) => (
                <Card key={story.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2 shrink-0 pt-0.5">
                        {isSM && <GripVertical className="h-4 w-4 text-slate-300" />}
                        <span className="text-xs font-mono text-slate-400 w-5 text-right">{idx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-900">{story.title}</span>
                          {story.jira_key && (
                            <Badge variant="secondary" className="text-[10px] font-mono">{story.jira_key}</Badge>
                          )}
                        </div>
                        {story.description && (
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{story.description}</p>
                        )}
                      </div>
                      {isSM && (
                        <button
                          onClick={() => handleDeleteStory(story.id)}
                          disabled={deletingStoryId === story.id}
                          className="shrink-0 p-1 text-slate-300 hover:text-red-500 transition-colors rounded"
                        >
                          {deletingStoryId === story.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />
                          }
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Member info panel */}
        {!isSM && (
          <Card className="bg-indigo-50 border-indigo-200">
            <CardContent className="p-5 flex items-start gap-3">
              <Users className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-indigo-900">Session not started yet</p>
                <p className="text-sm text-indigo-700 mt-0.5">
                  Review the stories above to come prepared. Your Scrum Master will start the session when the team is ready.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Story Dialog */}
      <Dialog open={showAddStory} onOpenChange={(open) => { setShowAddStory(open); if (!open) { setAddMode("manual"); setAddStoryError(null); } }}>
        <DialogContent className="max-w-xl flex flex-col gap-0 p-0 max-h-[88vh]">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b border-slate-100">
            <DialogTitle>Add Story</DialogTitle>
            <DialogDescription>Add stories manually or import from Jira.</DialogDescription>
          </DialogHeader>

          {/* Mode Tabs */}
          <div className="px-6 pt-4 shrink-0">
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button type="button" onClick={() => setAddMode("manual")}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition ${addMode === "manual" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                ✏️ Manual Entry
              </button>
              <button type="button" onClick={() => setAddMode("jira")}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition ${addMode === "jira" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
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
                    <p className="text-xs text-amber-600 mb-3">Connect your Jira workspace in Settings → Integrations first.</p>
                    <Button size="sm" variant="outline" onClick={() => router.push("/settings/integrations")}>
                      <ExternalLink className="h-3 w-3 mr-1" /> Go to Integrations
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      {/* Searchable board dropdown */}
                      <div className="flex-1 relative">
                        <Input
                          placeholder="Search boards..."
                          value={boardSearchText}
                          onChange={(e) => { setBoardSearchText(e.target.value); setShowBoardDropdown(true); }}
                          onFocus={() => setShowBoardDropdown(true)}
                          onBlur={() => setTimeout(() => setShowBoardDropdown(false), 200)}
                          className="text-sm w-full"
                        />
                        {showBoardDropdown && jiraBoards.length > 0 && (
                          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                            {jiraBoards.filter((b: any) => b.name.toLowerCase().includes(boardSearchText.toLowerCase())).map((b: any) => (
                              <button key={b.id} type="button"
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition ${selectedBoard === String(b.id) ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700"}`}
                                onMouseDown={(e) => { e.preventDefault(); setSelectedBoard(String(b.id)); setBoardSearchText(b.name); setShowBoardDropdown(false); loadSprints(String(b.id)); }}>
                                {b.name}
                              </button>
                            ))}
                            {jiraBoards.filter((b: any) => b.name.toLowerCase().includes(boardSearchText.toLowerCase())).length === 0 && (
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

                    {jiraLoading && (
                      <div className="flex items-center justify-center py-6 text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
                      </div>
                    )}

                    {!jiraLoading && jiraIssues.length > 0 && (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input placeholder="Filter by key or title..." value={jiraSearchQuery}
                          onChange={(e) => setJiraSearchQuery(e.target.value)} className="pl-9 text-sm" />
                      </div>
                    )}

                    {!jiraLoading && jiraIssues.length > 0 && (() => {
                      const q = jiraSearchQuery.trim().toLowerCase();
                      const filtered = q ? jiraIssues.filter((i: any) => i.key.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q)) : jiraIssues;
                      return (
                        <>
                          <div className="border border-slate-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-slate-100">
                            {filtered.length > 0 ? filtered.map((issue: any) => {
                              const already = stories.some((s) => s.jira_key === issue.key);
                              return (
                                <label key={issue.key} className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition ${already ? "opacity-50" : ""}`}>
                                  <input type="checkbox" className="mt-1 rounded border-slate-300"
                                    checked={selectedJiraIssues.has(issue.key)}
                                    onChange={() => { const n = new Set(selectedJiraIssues); n.has(issue.key) ? n.delete(issue.key) : n.add(issue.key); setSelectedJiraIssues(n); }}
                                    disabled={already} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-mono font-semibold text-indigo-600">{issue.key}</span>
                                      {issue.type && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{issue.type}</span>}
                                      {issue.storyPoints != null && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600">{issue.storyPoints} SP</span>}
                                      {already && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-600">Already added</span>}
                                    </div>
                                    <p className="text-sm text-slate-700 truncate">{issue.summary}</p>
                                  </div>
                                </label>
                              );
                            }) : <div className="text-center py-4 text-sm text-slate-400">No issues match</div>}
                          </div>
                          <div className="text-[11px] text-slate-400">{filtered.length} of {jiraIssues.length} stories</div>
                        </>
                      );
                    })()}

                    {!jiraLoading && jiraIssues.length === 0 && selectedSprint && (
                      <div className="text-center py-6 text-sm text-slate-400">No stories in this sprint</div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                  <Input placeholder="As a user, I want to..." value={storyTitle}
                    onChange={(e) => setStoryTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && storyTitle.trim()) handleAddStory(); }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    rows={3} placeholder="Additional context for the team..."
                    value={storyDescription} onChange={(e) => setStoryDescription(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Jira Key <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <Input placeholder="PROJ-123" value={storyJiraKey}
                    onChange={(e) => setStoryJiraKey(e.target.value.toUpperCase())} className="font-mono" />
                </div>
                {addStoryError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{addStoryError}</div>}
              </div>
            )}
          </div>

          {/* Sticky action footer */}
          <div className="px-6 py-4 shrink-0 border-t border-slate-100 bg-white flex justify-end gap-2">
            {addMode === "jira" ? (
              <>
                <Button variant="outline" onClick={() => setShowAddStory(false)}>Cancel</Button>
                <Button onClick={importJiraIssues} disabled={jiraLoading || selectedJiraIssues.size === 0}>
                  {jiraLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Add {selectedJiraIssues.size > 0 ? `${selectedJiraIssues.size} ` : ""}Selected
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => { setShowAddStory(false); setAddStoryError(null); }}>Cancel</Button>
                <Button onClick={handleAddStory} disabled={addingStory || !storyTitle.trim()}>
                  {addingStory ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  {addingStory ? "Adding..." : "Add Story"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
