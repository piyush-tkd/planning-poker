/**
 * POST /api/jira/comment
 * Adds a status comment to a Jira issue without changing story points.
 * Used for no-consensus, no-time, and skipped story scenarios.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { JiraClient } from "@/lib/jira/client";

interface CommentRequest {
  issueKey: string;
  reason: "no_consensus" | "no_time" | "skipped";
  smNote?: string;
}

interface JiraConfigData {
  jiraUrl: string;
  email: string;
  apiToken: string;
  storyPointsField?: string;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: orgMember } = await supabase
      .from("org_members")
      .select("org_id, display_name, organizations(jira_config)")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    const org = orgMember?.organizations as unknown as { jira_config: JiraConfigData | null } | null;
    if (!org?.jira_config) {
      return NextResponse.json({ error: "Jira not connected" }, { status: 400 });
    }

    const body = (await request.json()) as CommentRequest;
    const { issueKey, reason, smNote } = body;
    if (!issueKey || !reason) {
      return NextResponse.json({ error: "Missing issueKey or reason" }, { status: 400 });
    }

    const client = new JiraClient(org.jira_config);
    await client.addStatusComment(issueKey, reason, smNote);

    // Audit log
    await supabase.rpc("log_org_event", {
      p_org_id: orgMember!.org_id,
      p_action: "jira.comment_added",
      p_description: `Added "${reason}" comment to ${issueKey}`,
      p_metadata: { issue_key: issueKey, reason, has_note: !!smNote },
      p_actor_name: orgMember?.display_name || user.email || null,
    });

    return NextResponse.json({ success: true, issueKey, reason });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
