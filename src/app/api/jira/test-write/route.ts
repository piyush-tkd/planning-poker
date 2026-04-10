/**
 * POST /api/jira/test-write
 * Debug endpoint: tests writing story points + comment to a specific Jira issue
 * Returns detailed step-by-step results
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

interface JiraConfigData {
  jiraUrl: string;
  email: string;
  apiToken: string;
  storyPointsField?: string;
}

export async function POST(request: NextRequest) {
  const log: string[] = [];

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
    if (!user) return NextResponse.json({ error: "Unauthorized", log }, { status: 401 });

    log.push(`✓ Authenticated as ${user.email}`);

    const { data: orgMember } = await supabase
      .from("org_members")
      .select("org_id, organizations(jira_config)")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!orgMember) return NextResponse.json({ error: "No org found", log }, { status: 404 });

    const org = orgMember.organizations as unknown as { jira_config: JiraConfigData | null } | null;
    const jiraConfig = org?.jira_config;
    if (!jiraConfig) return NextResponse.json({ error: "Jira not connected", log }, { status: 400 });

    log.push(`✓ Jira config found`);
    log.push(`  URL: ${jiraConfig.jiraUrl}`);
    log.push(`  Email: ${jiraConfig.email}`);
    log.push(`  Token: ${jiraConfig.apiToken ? jiraConfig.apiToken.substring(0, 4) + "..." : "MISSING"}`);
    log.push(`  SP Field: ${jiraConfig.storyPointsField || "customfield_10016"}`);

    const body = await request.json();
    const { issueKey, storyPoints } = body;
    log.push(`\n→ Testing write to ${issueKey} with ${storyPoints} SP`);

    // Build auth
    let jiraUrl = (jiraConfig.jiraUrl || "").replace(/\/$/, "");
    if (!jiraUrl.startsWith("http")) jiraUrl = `https://${jiraUrl}`;
    const credentials = `${jiraConfig.email}:${jiraConfig.apiToken}`;
    const authHeader = `Basic ${Buffer.from(credentials).toString("base64")}`;
    const spField = jiraConfig.storyPointsField || "customfield_10016";

    // Step 1: Fetch issue to verify it exists and see current SP value
    log.push(`\n--- STEP 1: Fetch issue ${issueKey} ---`);
    try {
      const fetchRes = await fetch(
        `${jiraUrl}/rest/api/3/issue/${issueKey}?fields=summary,${spField}`,
        {
          headers: { Authorization: authHeader, Accept: "application/json" },
        }
      );
      const fetchText = await fetchRes.text();
      log.push(`  Status: ${fetchRes.status}`);
      if (fetchRes.ok) {
        const fetchData = JSON.parse(fetchText);
        log.push(`  Summary: ${fetchData.fields?.summary}`);
        log.push(`  Current ${spField}: ${JSON.stringify(fetchData.fields?.[spField])}`);
      } else {
        log.push(`  Error: ${fetchText.substring(0, 500)}`);
        return NextResponse.json({ success: false, log }, { status: 200 });
      }
    } catch (e: any) {
      log.push(`  Exception: ${e.message}`);
      return NextResponse.json({ success: false, log }, { status: 200 });
    }

    // Step 2: Update story points
    log.push(`\n--- STEP 2: PUT story points ---`);
    log.push(`  Field: ${spField}`);
    log.push(`  Value: ${storyPoints} (type: ${typeof storyPoints})`);
    const updateBody = { fields: { [spField]: Number(storyPoints) } };
    log.push(`  Body: ${JSON.stringify(updateBody)}`);

    try {
      const putRes = await fetch(
        `${jiraUrl}/rest/api/3/issue/${issueKey}`,
        {
          method: "PUT",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(updateBody),
        }
      );
      const putText = await putRes.text();
      log.push(`  Status: ${putRes.status}`);
      log.push(`  Response: ${putText || "(empty - expected for 204)"}`);

      if (!putRes.ok) {
        log.push(`  ❌ UPDATE FAILED`);
        return NextResponse.json({ success: false, log }, { status: 200 });
      }
      log.push(`  ✓ Update succeeded`);
    } catch (e: any) {
      log.push(`  Exception: ${e.message}`);
      return NextResponse.json({ success: false, log }, { status: 200 });
    }

    // Step 3: Verify the update
    log.push(`\n--- STEP 3: Verify update ---`);
    try {
      const verifyRes = await fetch(
        `${jiraUrl}/rest/api/3/issue/${issueKey}?fields=${spField}`,
        {
          headers: { Authorization: authHeader, Accept: "application/json" },
        }
      );
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        log.push(`  ${spField} after update: ${JSON.stringify(verifyData.fields?.[spField])}`);
      }
    } catch (e: any) {
      log.push(`  Verify exception: ${e.message}`);
    }

    // Step 4: Add comment
    log.push(`\n--- STEP 4: Add comment ---`);
    const now = new Date();
    const cstTime = now.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      dateStyle: "long",
      timeStyle: "short",
    });
    const commentBody = {
      body: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: `Story refined on ${cstTime} CST and story points given ` },
              { type: "text", text: String(storyPoints), marks: [{ type: "strong" }] },
            ],
          },
        ],
      },
    };
    log.push(`  Comment body: ${JSON.stringify(commentBody).substring(0, 200)}...`);

    try {
      const commentRes = await fetch(
        `${jiraUrl}/rest/api/3/issue/${issueKey}/comment`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(commentBody),
        }
      );
      const commentText = await commentRes.text();
      log.push(`  Status: ${commentRes.status}`);
      if (commentRes.ok) {
        log.push(`  ✓ Comment added`);
      } else {
        log.push(`  ❌ Comment failed: ${commentText.substring(0, 500)}`);
      }
    } catch (e: any) {
      log.push(`  Exception: ${e.message}`);
    }

    log.push(`\n=== DONE ===`);
    return NextResponse.json({ success: true, log }, { status: 200 });

  } catch (e: any) {
    log.push(`Fatal error: ${e.message}`);
    return NextResponse.json({ success: false, error: e.message, log }, { status: 500 });
  }
}
