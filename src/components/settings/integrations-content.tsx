"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ExternalLink, Check, X, Loader2, Pencil, Bell, Trash2, Plus } from "lucide-react";

interface JiraConfig {
  jiraUrl: string;
  email: string;
  apiToken: string;
  storyPointsField: string;
  connectedAt: string;
}

interface JiraFieldOption {
  id: string;
  name: string;
  custom: boolean;
  type: string;
}

export function IntegrationsContent() {
  const { currentOrg, membership, user } = useAuthStore();
  const actorName = membership?.display_name || user?.email || "Unknown";
  const isAdmin = membership?.role === "admin";

  // Webhooks state
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(true);
  const [newWebhookName, setNewWebhookName] = useState("Slack");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [addingWebhook, setAddingWebhook] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [jiraUrl, setJiraUrl] = useState("baylorgenetics.atlassian.net");
  const [jiraEmail, setJiraEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [storyPointsField, setStoryPointsField] = useState("customfield_10016");
  const [connectedConfig, setConnectedConfig] = useState<JiraConfig | null>(null);

  // Field picker state
  const [editingField, setEditingField] = useState(false);
  const [availableFields, setAvailableFields] = useState<JiraFieldOption[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);

  // Debug test write
  const [testIssueKey, setTestIssueKey] = useState("");
  const [testPoints, setTestPoints] = useState("3");
  const [testRunning, setTestRunning] = useState(false);
  const [testLog, setTestLog] = useState<string[]>([]);

  const supabase = createClient();

  useEffect(() => {
    loadJiraConfig();
    loadWebhooks();
  }, [currentOrg]);

  const loadWebhooks = async () => {
    if (!currentOrg) return;
    setWebhooksLoading(true);
    const { data } = await supabase.from("org_webhooks").select("*").eq("org_id", currentOrg.id).order("created_at");
    setWebhooks(data || []);
    setWebhooksLoading(false);
  };

  const saveWebhook = async () => {
    if (!newWebhookUrl.trim() || !currentOrg) return;
    setSavingWebhook(true);
    setWebhookError(null);
    const { error } = await supabase.from("org_webhooks").insert({
      org_id: currentOrg.id,
      name: newWebhookName.trim() || "Webhook",
      url: newWebhookUrl.trim(),
      created_by: user?.id,
    });
    if (error) { setWebhookError(error.message); }
    else { setNewWebhookUrl(""); setNewWebhookName("Slack"); setAddingWebhook(false); await loadWebhooks(); }
    setSavingWebhook(false);
  };

  const deleteWebhook = async (id: string) => {
    await supabase.from("org_webhooks").delete().eq("id", id);
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

  const testWebhook = async (url: string, id: string) => {
    setTestingWebhook(id);
    try {
      await fetch("/api/webhook/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    } catch {}
    setTestingWebhook(null);
  };

  const loadJiraConfig = async () => {
    if (!currentOrg) return;
    setLoading(true);

    const { data } = await supabase
      .from("organizations")
      .select("jira_config")
      .eq("id", currentOrg.id)
      .single();

    if (data?.jira_config) {
      const config = data.jira_config as JiraConfig;
      setIsConnected(true);
      setConnectedConfig(config);
      setJiraUrl(config.jiraUrl);
      setJiraEmail(config.email);
      setStoryPointsField(config.storyPointsField || "customfield_10016");
    }
    setLoading(false);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/jira/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jiraUrl,
          email: jiraEmail,
          apiToken,
          storyPointsField,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to connect to Jira");
        setSaving(false);
        return;
      }

      setSuccess("Connected to Jira successfully!");
      setIsConnected(true);
      setConnectedConfig({
        jiraUrl,
        email: jiraEmail,
        apiToken: "••••••••",
        storyPointsField,
        connectedAt: new Date().toISOString(),
      });
      setApiToken("");
    } catch (err: any) {
      setError(err.message || "Unexpected error");
    }
    setSaving(false);
  };

  const loadJiraFields = async () => {
    setFieldsLoading(true);
    try {
      const res = await fetch("/api/jira/fields");
      if (res.ok) {
        const data = await res.json();
        setAvailableFields(data.fields || []);
      }
    } catch (e) {
      console.error("Failed to load fields:", e);
    }
    setFieldsLoading(false);
  };

  const handleUpdateField = async (fieldId: string, fieldName: string) => {
    if (!currentOrg || !connectedConfig) return;
    setSaving(true);
    setError(null);

    const { data: orgData } = await supabase
      .from("organizations")
      .select("jira_config")
      .eq("id", currentOrg.id)
      .single();

    if (orgData?.jira_config) {
      const updatedConfig = { ...orgData.jira_config as Record<string, unknown>, storyPointsField: fieldId };
      const { error: updateError } = await supabase
        .from("organizations")
        .update({ jira_config: updatedConfig })
        .eq("id", currentOrg.id);

      if (updateError) {
        setError("Failed to update field: " + updateError.message);
      } else {
        setConnectedConfig({ ...connectedConfig, storyPointsField: fieldId });
        setStoryPointsField(fieldId);
        setEditingField(false);
        setSuccess(`Story points field updated to "${fieldName}" (${fieldId})`);
        setTimeout(() => setSuccess(null), 3000);
        // Log the field change
        await supabase.rpc("log_org_event", {
          p_org_id: currentOrg.id,
          p_action: "jira.field_updated",
          p_description: `Story points field changed to "${fieldName}" (${fieldId})`,
          p_metadata: { old_field: connectedConfig.storyPointsField, new_field: fieldId, field_name: fieldName },
          p_actor_name: actorName,
        });
      }
    }
    setSaving(false);
  };

  const runTestWrite = async () => {
    if (!testIssueKey.trim()) return;
    setTestRunning(true);
    setTestLog(["Starting test..."]);
    try {
      const res = await fetch("/api/jira/test-write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueKey: testIssueKey.trim(), storyPoints: Number(testPoints) }),
      });
      const data = await res.json();
      setTestLog(data.log || ["No log returned"]);
    } catch (e: any) {
      setTestLog([`Request failed: ${e.message}`]);
    }
    setTestRunning(false);
  };

  const handleDisconnect = async () => {
    if (!currentOrg) return;
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("organizations")
      .update({ jira_config: null })
      .eq("id", currentOrg.id);

    if (updateError) {
      setError("Failed to disconnect: " + updateError.message);
    } else {
      await supabase.rpc("log_org_event", {
        p_org_id: currentOrg.id,
        p_action: "jira.disconnected",
        p_description: "Disconnected Jira integration",
        p_metadata: { jira_url: connectedConfig?.jiraUrl },
        p_actor_name: actorName,
      });
      setIsConnected(false);
      setConnectedConfig(null);
      setApiToken("");
      setSuccess("Disconnected from Jira");
    }
    setSaving(false);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/jira/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jiraUrl: isConnected ? connectedConfig?.jiraUrl : jiraUrl,
          email: isConnected ? connectedConfig?.email : jiraEmail,
          apiToken: isConnected ? connectedConfig?.apiToken : apiToken,
          storyPointsField,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess("Connection test passed!");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Connection test failed");
      }
    } catch (err: any) {
      setError(err.message || "Test failed");
    }
    setTesting(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Card className={isConnected ? "border-green-200" : ""}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">J</div>
              <div>
                Jira Integration
                <p className="text-sm text-slate-500 font-normal mt-0.5">Connect your Jira account to sync stories and sprints</p>
              </div>
            </CardTitle>
            {isConnected && (
              <Badge className="bg-green-600 text-white"><Check className="h-3 w-3 mr-1" /> Connected</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isConnected && connectedConfig ? (
            <>
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-700">Jira URL</span>
                  <code className="font-mono text-green-900">https://{connectedConfig.jiraUrl}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700">Email</span>
                  <span className="text-green-900">{connectedConfig.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-green-700">Story Points Field</span>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-green-900">{connectedConfig.storyPointsField}</code>
                    <button
                      type="button"
                      className="text-indigo-600 hover:text-indigo-800 transition"
                      onClick={() => {
                        setEditingField(!editingField);
                        if (!editingField && availableFields.length === 0) {
                          loadJiraFields();
                        }
                      }}
                      title="Change story points field"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700">Connected</span>
                  <span className="text-green-900">{new Date(connectedConfig.connectedAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Field picker */}
              {editingField && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Select Story Points Field</label>
                    <p className="text-xs text-slate-500 mb-2">Choose which Jira field to read/write story points from. Each board may use a different custom field.</p>
                  </div>

                  {fieldsLoading ? (
                    <div className="flex items-center justify-center py-4 text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading fields from Jira...
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        placeholder="Search fields..."
                        value={fieldSearch}
                        onChange={(e) => {
                          setFieldSearch(e.target.value);
                          setShowFieldDropdown(true);
                        }}
                        onFocus={() => setShowFieldDropdown(true)}
                        onBlur={() => setTimeout(() => setShowFieldDropdown(false), 200)}
                        className="text-sm bg-white"
                      />
                      {showFieldDropdown && availableFields.length > 0 && (
                        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                          {availableFields
                            .filter((f) =>
                              f.name.toLowerCase().includes(fieldSearch.toLowerCase()) ||
                              f.id.toLowerCase().includes(fieldSearch.toLowerCase())
                            )
                            .map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition flex justify-between items-center gap-2 ${
                                  connectedConfig.storyPointsField === f.id ? "bg-indigo-50 text-indigo-700" : "text-slate-700"
                                }`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleUpdateField(f.id, f.name);
                                }}
                              >
                                <div>
                                  <span className="font-medium">{f.name}</span>
                                  {connectedConfig.storyPointsField === f.id && (
                                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600">current</span>
                                  )}
                                </div>
                                <code className="text-xs text-slate-400 font-mono">{f.id}</code>
                              </button>
                            ))}
                          {availableFields.filter((f) =>
                            f.name.toLowerCase().includes(fieldSearch.toLowerCase()) ||
                            f.id.toLowerCase().includes(fieldSearch.toLowerCase())
                          ).length === 0 && (
                            <div className="px-3 py-2 text-sm text-slate-400">No matching fields</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingField(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex gap-2">
                  <X className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              {success && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleTestConnection} disabled={testing}>
                  {testing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testing...</> : "Test Connection"}
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleDisconnect} disabled={saving}>
                  {saving ? "Disconnecting..." : "Disconnect"}
                </Button>
              </div>
            </>
          ) : (
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jira Cloud URL</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">https://</span>
                  <Input value={jiraUrl} onChange={(e) => setJiraUrl(e.target.value)} placeholder="yourcompany.atlassian.net" className="font-mono" required />
                </div>
                <p className="text-xs text-slate-500 mt-1">Your Jira Cloud domain (without https://)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jira Email</label>
                <Input type="email" value={jiraEmail} onChange={(e) => setJiraEmail(e.target.value)} placeholder="you@company.com" required />
                <p className="text-xs text-slate-500 mt-1">Your Jira account email address</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">API Token</label>
                <Input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} placeholder="Paste your Jira API token" required />
                <p className="text-xs text-slate-500 mt-1">
                  Generate a token at{" "}
                  <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-0.5">
                    Atlassian API Tokens <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Story Points Field (Optional)</label>
                <Input value={storyPointsField} onChange={(e) => setStoryPointsField(e.target.value)} placeholder="customfield_10016" className="font-mono" />
                <p className="text-xs text-slate-500 mt-1">Custom field ID for story points in your Jira instance</p>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex gap-2">
                  <X className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Connection Error</p>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}
              {success && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={handleTestConnection} disabled={testing || !jiraUrl || !jiraEmail || !apiToken}>
                  {testing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testing...</> : "Test Connection"}
                </Button>
                <Button type="submit" className="flex-1" disabled={saving || !jiraUrl || !jiraEmail || !apiToken}>
                  {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting...</> : <>Connect to Jira <ArrowRight className="h-4 w-4 ml-1" /></>}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 bg-slate-50 rounded-lg border border-slate-200 p-4">
        <h4 className="font-medium text-slate-900 mb-2">How to connect Jira</h4>
        <ol className="space-y-1.5 text-sm text-slate-600 list-decimal list-inside">
          <li>Go to <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Atlassian API Tokens</a> and create a new token</li>
          <li>Enter your Jira Cloud URL (e.g., baylorgenetics.atlassian.net)</li>
          <li>Provide your Jira account email and the API token</li>
          <li>Click &ldquo;Connect to Jira&rdquo; to save and verify the connection</li>
        </ol>
        <p className="text-xs text-slate-500 mt-3">Once connected, you can import stories from Jira sprints directly into your planning poker sessions. Final estimates are automatically synced back to Jira.</p>
      </div>

      {/* Debug: Test Write */}
      {isConnected && (
        <div className="mt-6 bg-amber-50 rounded-lg border border-amber-200 p-4 space-y-3">
          <h4 className="font-medium text-amber-900 mb-1">Debug: Test Write to Jira</h4>
          <p className="text-xs text-amber-700">Enter an issue key to test writing story points and adding a comment. This runs step-by-step and shows exactly what happens.</p>
          <div className="flex gap-2">
            <Input
              placeholder="Issue key (e.g. CEP-3238)"
              value={testIssueKey}
              onChange={(e) => setTestIssueKey(e.target.value)}
              className="font-mono text-sm bg-white flex-1"
            />
            <Input
              type="number"
              placeholder="SP"
              value={testPoints}
              onChange={(e) => setTestPoints(e.target.value)}
              className="w-20 text-sm bg-white text-center"
            />
            <Button
              size="sm"
              onClick={runTestWrite}
              disabled={testRunning || !testIssueKey.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {testRunning ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Running...</> : "Run Test"}
            </Button>
          </div>
          {testLog.length > 0 && (
            <pre className="bg-slate-900 text-green-400 text-xs font-mono p-3 rounded-lg overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap">
              {testLog.join("\n")}
            </pre>
          )}
        </div>
      )}

      {/* ── Slack / Teams Webhooks ── */}
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center text-white">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                Slack &amp; Teams Notifications
                <p className="text-sm text-slate-500 font-normal mt-0.5">Post to a channel when a session goes live</p>
              </div>
            </CardTitle>
            {isAdmin && !addingWebhook && (
              <button onClick={() => setAddingWebhook(true)} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                <Plus className="h-4 w-4" /> Add webhook
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {webhooksLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-indigo-600" /></div>
          ) : (
            <>
              {webhooks.length === 0 && !addingWebhook && (
                <p className="text-sm text-slate-400 text-center py-4">No webhooks configured yet.</p>
              )}
              {webhooks.map((wh) => (
                <div key={wh.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{wh.name}</span>
                      {wh.is_active && <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">Active</span>}
                    </div>
                    <p className="text-xs text-slate-400 font-mono truncate mt-0.5">{wh.url}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => testWebhook(wh.url, wh.id)}
                        disabled={testingWebhook === wh.id}
                        className="text-xs px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                      >
                        {testingWebhook === wh.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Test"}
                      </button>
                      <button onClick={() => deleteWebhook(wh.id)} className="p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {addingWebhook && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
                  <p className="text-sm font-medium text-indigo-800">New webhook</p>
                  <div className="flex gap-2">
                    <select
                      value={newWebhookName}
                      onChange={(e) => setNewWebhookName(e.target.value)}
                      className="text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 w-32 outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                      <option>Slack</option>
                      <option>Teams</option>
                      <option>Discord</option>
                      <option>Custom</option>
                    </select>
                    <Input
                      placeholder="https://hooks.slack.com/services/…"
                      value={newWebhookUrl}
                      onChange={(e) => setNewWebhookUrl(e.target.value)}
                      className="flex-1 text-sm bg-white"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    In Slack: Apps → Incoming Webhooks → Add to channel → copy URL.{" "}
                    <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Guide →</a>
                  </p>
                  {webhookError && <p className="text-xs text-red-600">{webhookError}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveWebhook} disabled={savingWebhook || !newWebhookUrl.trim()}>
                      {savingWebhook ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving…</> : "Save"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setAddingWebhook(false); setWebhookError(null); setNewWebhookUrl(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
