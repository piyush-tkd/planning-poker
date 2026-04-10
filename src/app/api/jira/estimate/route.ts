/**
 * POST /api/jira/estimate
 * Updates story points estimate for a Jira issue
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { JiraClient } from "@/lib/jira/client";

interface EstimateRequest {
  issueKey: string;
  storyPoints: number;
}

interface JiraConfigData {
  jiraUrl: string;
  email: string;
  apiToken: string;
  storyPointsField?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get user from Supabase
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's organization and Jira config
    const { data: orgMember, error: orgError } = await supabase
      .from("org_members")
      .select("org_id, display_name, organizations(jira_config)")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (orgError || !orgMember) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const org = orgMember.organizations as unknown as { jira_config: JiraConfigData | null } | null;
    const jiraConfig = org?.jira_config;

    if (!jiraConfig) {
      return NextResponse.json(
        { error: "Jira workspace not connected" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = (await request.json()) as EstimateRequest;
    const { issueKey, storyPoints } = body;

    // Validate required fields
    if (!issueKey || storyPoints === undefined || storyPoints === null) {
      return NextResponse.json(
        { error: "Missing required fields: issueKey, storyPoints" },
        { status: 400 }
      );
    }

    // Validate storyPoints is a number
    if (typeof storyPoints !== "number" || storyPoints < 0) {
      return NextResponse.json(
        { error: "storyPoints must be a non-negative number" },
        { status: 400 }
      );
    }

    // Update story points in Jira
    const client = new JiraClient(jiraConfig);

    try {
      console.log(`[Jira Sync] Updating ${issueKey} with ${storyPoints} SP using field ${jiraConfig.storyPointsField || "customfield_10016"}`);
      await client.updateStoryPoints(issueKey, storyPoints);
      console.log(`[Jira Sync] Successfully updated ${issueKey} and added comment`);

      // Log the event
      await supabase.rpc("log_org_event", {
        p_org_id: orgMember.org_id,
        p_action: "jira.estimate_synced",
        p_description: `Synced ${storyPoints} SP to ${issueKey}`,
        p_metadata: { issue_key: issueKey, story_points: storyPoints },
        p_actor_name: orgMember.display_name || user.email || null,
      });

      return NextResponse.json(
        {
          success: true,
          message: `Story points updated for ${issueKey} and comment added`,
          issueKey,
          storyPoints,
        },
        { status: 200 }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Jira Sync] Failed for ${issueKey}:`, errorMessage);
      return NextResponse.json(
        { error: `Failed to update story points: ${errorMessage}` },
        { status: 400 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Update estimate error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
