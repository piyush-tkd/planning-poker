import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Paths that don't require org membership — new users landing here skip onboarding
const MEMBERSHIP_FREE_PATHS = [
  /^\/session\/[^/]+\/preview$/,
  /^\/join\//,
  /^\/guest\//,
  /^\/invite\//,
];

function isMembershipFreePath(path: string) {
  return MEMBERSHIP_FREE_PATHS.some((re) => re.test(path));
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Auto-claim any pending invite that matches the user's email
        await supabase.rpc("auto_claim_invite_by_email");

        // Re-check membership (may have just been granted via invite claim)
        const { data: memberships } = await supabase
          .from("org_members")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);

        if (!memberships || memberships.length === 0) {
          // New user with no org — if they came from a preview/join/invite link,
          // let them through directly rather than forcing full onboarding
          if (isMembershipFreePath(next)) {
            return NextResponse.redirect(`${origin}${next}`);
          }
          return NextResponse.redirect(`${origin}/select-plan`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
