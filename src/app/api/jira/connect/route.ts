/**
 * POST /api/jira/connect
 * Connects Jira Cloud workspace to PointIt organization
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { JiraClient } from "@/lib/jira/client";

interface ConnectRequest {
  jiraUrl: string;
  email: string;
  apiToken: string;
  storyPointsField?: string;
}

interface JiraConfigData {
  jiraUrl: string;
  email: string;
  apiToken: string;
  storyPointsField: string;
  connectedAt: string;
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

    // Get user's organization (include display_name for audit log)
    const { data: orgMember, error: orgError } = await supabase
      .from("org_members")
      .select("org_id, display_name, organizations(id, name)")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (orgError || !orgMember) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Parse request body
    const body = (await request.json()) as ConnectRequest;
    const { jiraUrl, email, apiToken, storyPointsField } = body;

    // Validate required fields
    if (!jiraUrl || !email || !apiToken) {
      return NextResponse.json(
        { error: "Missing required fields: jiraUrl, email, apiToken" },
        { status: 400 }
      );
    }

    // Test connection to Jira
    const client = new JiraClient({
      jiraUrl,
      email,
      apiToken,
      storyPointsField,
    });

    try {
      await client.testConnection();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json(
        { error: `Failed to connect to Jira: ${errorMessage}` },
        { status: 400 }
      );
    }

    // Store config in organization
    const jiraConfig: JiraConfigData = {
      jiraUrl,
      email,
      apiToken,
      storyPointsField: storyPointsField || "customfield_10016",
      connectedAt: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        jira_config: jiraConfig,
      })
      .eq("id", orgMember.org_id);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to save Jira config: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Log the event
    await supabase.rpc("log_org_event", {
      p_org_id: orgMember.org_id,
      p_action: "jira.connected",
      p_description: `Connected Jira workspace: ${jiraUrl}`,
      p_metadata: { jira_url: jiraUrl, email },
      p_actor_name: orgMember.display_name || user.email || null,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Jira workspace connected successfully",
        jiraUrl,
        storyPointsField: jiraConfig.storyPointsField,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Jira connect error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
