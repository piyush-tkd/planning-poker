"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import {
  Plus, Trash2, Edit2, Save, X, BookTemplate, Layers, ChevronDown, ChevronUp, GripVertical
} from "lucide-react";

interface TemplateStory {
  title: string;
  description?: string;
}

interface SessionTemplate {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  card_deck: string;
  stories: TemplateStory[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const DECK_OPTIONS = [
  { value: "fibonacci", label: "Fibonacci (0, 1, 2, 3, 5, 8, 13, 21…)" },
  { value: "tshirt", label: "T-Shirt (XS, S, M, L, XL, XXL)" },
];

export function TemplatesContent() {
  const { currentOrg, membership } = useAuthStore();
  const supabase = createClient();
  const role = membership?.role ?? "member";
  const canManage = role === "admin" || role === "scrum_master";

  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDeck, setFormDeck] = useState("fibonacci");
  const [formStories, setFormStories] = useState<TemplateStory[]>([{ title: "" }]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrg) loadTemplates();
  }, [currentOrg?.id]);

  const loadTemplates = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from("session_templates")
      .select("*")
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: false });
    if (data) setTemplates(data as SessionTemplate[]);
    setLoading(false);
  };

  const resetForm = () => {
    setFormName("");
    setFormDesc("");
    setFormDeck("fibonacci");
    setFormStories([{ title: "" }]);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const openEdit = (t: SessionTemplate) => {
    setFormName(t.name);
    setFormDesc(t.description ?? "");
    setFormDeck(t.card_deck);
    setFormStories(t.stories.length > 0 ? t.stories : [{ title: "" }]);
    setEditingId(t.id);
    setShowCreate(true);
  };

  const addStory = () => setFormStories((prev) => [...prev, { title: "" }]);
  const removeStory = (i: number) => setFormStories((prev) => prev.filter((_, idx) => idx !== i));
  const updateStory = (i: number, field: keyof TemplateStory, value: string) => {
    setFormStories((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  const handleSave = async () => {
    if (!formName.trim() || !currentOrg) return;
    setSaving(true);

    const validStories = formStories.filter((s) => s.title.trim()).map((s) => ({
      title: s.title.trim(),
      description: s.description?.trim() || undefined,
    }));

    const payload = {
      org_id: currentOrg.id,
      name: formName.trim(),
      description: formDesc.trim() || null,
      card_deck: formDeck,
      stories: validStories,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      await supabase.from("session_templates").update(payload).eq("id", editingId);
    } else {
      await supabase.from("session_templates").insert({
        ...payload,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });
    }

    await loadTemplates();
    setSaving(false);
    setShowCreate(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("session_templates").delete().eq("id", id);
    setDeleteConfirm(null);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-slate-400">Loading templates…</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Layers className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Session Templates</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Save a deck + story set as a reusable template — no starting from scratch each sprint.
                </p>
              </div>
            </div>
            {canManage && (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> New Template
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Template List */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Layers className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No templates yet.</p>
            {canManage && (
              <Button size="sm" className="mt-4" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Create your first template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id} className="overflow-hidden">
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition"
                onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                    <Layers className="h-4 w-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{t.name}</p>
                    {t.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs capitalize">{t.card_deck}</Badge>
                  <Badge variant="secondary" className="text-xs">{t.stories.length} stories</Badge>
                  {canManage && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(t.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {expandedId === t.id ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </div>

              {expandedId === t.id && t.stories.length > 0 && (
                <div className="border-t border-slate-100 px-5 py-3 bg-slate-50">
                  <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Stories</p>
                  <div className="space-y-1.5">
                    {t.stories.map((s, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-xs text-slate-400 mt-0.5 w-5 text-right flex-shrink-0">{i + 1}.</span>
                        <div>
                          <p className="text-sm text-slate-700">{s.title}</p>
                          {s.description && <p className="text-xs text-slate-400">{s.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { setShowCreate(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Template" : "New Session Template"}</DialogTitle>
            <DialogDescription>
              Save a card deck and story backlog so you can reuse it every sprint.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Template Name *</label>
              <Input
                placeholder="e.g. Sprint Planning – Portal Team"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <Input
                placeholder="Optional short description"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Card Deck</label>
              <Select
                value={formDeck}
                onChange={(e) => setFormDeck(e.target.value)}
                options={DECK_OPTIONS}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">Stories</label>
                <Button type="button" size="sm" variant="ghost" onClick={addStory} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Add Story
                </Button>
              </div>
              <div className="space-y-2">
                {formStories.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-5 text-right flex-shrink-0">{i + 1}.</span>
                    <Input
                      placeholder={`Story ${i + 1} title`}
                      value={s.title}
                      onChange={(e) => updateStory(i, "title", e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 flex-shrink-0"
                      onClick={() => removeStory(i)}
                      disabled={formStories.length === 1}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">Empty story rows will be skipped.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !formName.trim()}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? "Saving…" : editingId ? "Save Changes" : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Template?</DialogTitle>
            <DialogDescription>
              This will permanently delete the template. Sessions already started from it won't be affected.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
