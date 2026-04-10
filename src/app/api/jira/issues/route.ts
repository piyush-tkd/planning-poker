/**
 * GET /api/jira/issues
 * Fetches issues from Jira
 * Query params:
 *  - sprintId: Get issues from a specific sprint
 *  - boardId: Get backlog issues from a board (requires source=backlog)
 *  - source: "backlog" (required when using boardId)
 *  - jql: JQL query to search issues
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { JiraClient, FormattedIssue } from "@/lib/jira/client";

interface JiraConfigData {
  jiraUrl: string;
  email: string;
  apiToken: string;
  storyPointsField?: string;
}

export async function GET(request: NextRequest) {
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
      .select("org_id, organizations(jira_config)")
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

    // Get query parameters
    const sprintId = request.nextUrl.searchParams.get("sprintId");
    const boardId = request.nextUrl.searchParams.get("boardId");
    const source = request.nextUrl.searchParams.get("source");
    const jql = request.nextUrl.searchParams.get("jql");

    // Validate parameters
    if (!sprintId && !boardId && !jql) {
      return NextResponse.json(
        { error: "One of sprintId, boardId (with source=backlog), or jql query parameter is required" },
        { status: 400 }
      );
    }

    if (boardId && source !== "backlog") {
      return NextResponse.json(
        { error: "source=backlog is required when using boardId parameter" },
        { status: 400 }
      );
    }

    // Fetch issues from Jira
    const client = new JiraClient(jiraConfig);
    let issues: FormattedIssue[] = [];

    try {
      if (sprintId) {
        issues = await client.getSprintIssues(sprintId, ["Story"]);
      } else if (boardId && source === "backlog") {
        issues = await client.getBacklogIssues(boardId);
      } else if (jql) {
        issues = await client.searchIssues(jql);
      }

      return NextResponse.json(
        {
          success: true,
          issues,
        },
        { status: 200 }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json(
        { error: `Failed to fetch issues: ${errorMessage}` },
        { status: 400 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Get issues error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
