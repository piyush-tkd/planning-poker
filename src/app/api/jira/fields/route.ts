/**
 * GET /api/jira/fields
 * Fetches all fields from Jira (custom + system) for field picker
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

export async function GET(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: orgMember, error: orgError } = await supabase
      .from("org_members")
      .select("org_id, organizations(jira_config)")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (orgError || !orgMember) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const org = orgMember.organizations as unknown as { jira_config: JiraConfigData | null } | null;
    const jiraConfig = org?.jira_config;

    if (!jiraConfig) {
      return NextResponse.json({ error: "Jira workspace not connected" }, { status: 400 });
    }

    const client = new JiraClient(jiraConfig);

    try {
      const allFields = await client.getFields();

      // Filter to only numeric custom fields (likely story point candidates)
      // plus the standard "Story Points" and "Story point estimate" fields
      const pointsFields = allFields.filter((f) => {
        // Include custom number fields
        if (f.custom && f.schema?.type === "number") return true;
        // Include fields with "point" or "estimate" in name
        const nameLower = f.name.toLowerCase();
        if (nameLower.includes("point") || nameLower.includes("estimate")) return true;
        return false;
      });

      // Sort: custom fields with "story" or "point" in name first
      pointsFields.sort((a, b) => {
        const aRelevance = /story|point/i.test(a.name) ? 0 : 1;
        const bRelevance = /story|point/i.test(b.name) ? 0 : 1;
        if (aRelevance !== bRelevance) return aRelevance - bRelevance;
        return a.name.localeCompare(b.name);
      });

      return NextResponse.json({
        success: true,
        fields: pointsFields.map((f) => ({
          id: f.id,
          name: f.name,
          custom: f.custom,
          type: f.schema?.type || "unknown",
        })),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json(
        { error: `Failed to fetch fields: ${errorMessage}` },
        { status: 400 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Get fields error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
