/**
 * GET /api/jira/boards
 * Fetches list of Jira boards from connected workspace
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { JiraClient } from "@/lib/jira/client";

interface JiraConfigData {
  jiraUrl: string;
  email: string;
  apiToken: string;
  storyPointsField?: string;
}

interface BoardResponse {
  id: number;
  key: string;
  name: string;
  type: string;
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

    // Fetch boards from Jira
    const client = new JiraClient(jiraConfig);

    try {
      const boards = await client.getBoards();
      const formattedBoards: BoardResponse[] = boards.map((board) => ({
        id: board.id,
        key: board.key,
        name: board.name,
        type: board.type,
      }));

      return NextResponse.json(
        {
          success: true,
          boards: formattedBoards,
        },
        { status: 200 }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json(
        { error: `Failed to fetch boards: ${errorMessage}` },
        { status: 400 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Get boards error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
