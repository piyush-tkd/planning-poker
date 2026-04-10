import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Called internally when a session goes live.
// POST { session_id, org_id, session_name, team_name, started_by }
export async function POST(req: NextRequest) {
  try {
    const { session_id, org_id, session_name, team_name, started_by } = await req.json();
    if (!org_id) return NextResponse.json({ error: "org_id required" }, { status: 400 });

    const supabase = await createClient();
    const { data: webhooks } = await supabase
      .from("org_webhooks")
      .select("url, name")
      .eq("org_id", org_id)
      .eq("is_active", true)
      .contains("events", ["session.started"]);

    if (!webhooks || webhooks.length === 0) return NextResponse.json({ ok: true, sent: 0 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://planning-poker-jade-sigma.vercel.app";
    const sessionUrl = `${appUrl}/session/${session_id}`;

    const payload = {
      text: `🃏 *${session_name}* is live — join now!`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🃏 *${session_name}* is live on PointIt!\n*Team:* ${team_name || "—"}  •  *Started by:* ${started_by || "—"}`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Join Session →" },
              url: sessionUrl,
              style: "primary",
            },
          ],
        },
      ],
    };

    let sent = 0;
    for (const wh of webhooks) {
      try {
        const r = await fetch(wh.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.ok) sent++;
      } catch {}
    }

    return NextResponse.json({ ok: true, sent });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
