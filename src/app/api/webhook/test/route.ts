import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "✅ *PointIt webhook test* — your notifications are working!",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "✅ *PointIt webhook test*\nYour Slack integration is configured correctly. You'll receive notifications here when sessions go live.",
            },
          },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Webhook returned ${res.status}` }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
