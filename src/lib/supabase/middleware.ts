import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (except public routes)
  const publicPaths = ["/", "/login", "/signup", "/callback", "/join"];
  const isPublicPath = publicPaths.some(
    (path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith("/join/") || request.nextUrl.pathname.startsWith("/guest/") || request.nextUrl.pathname.startsWith("/invite/")
  );

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    // Preserve the original destination so we can redirect back after login
    const returnTo = request.nextUrl.pathname + request.nextUrl.search;
    url.pathname = "/login";
    url.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup")) {
    const url = request.nextUrl.clone();
    // If there's a returnTo param, honour it
    const returnTo = request.nextUrl.searchParams.get("returnTo");
    url.pathname = returnTo || "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Protect admin routes — check super_admin status
  if (user && request.nextUrl.pathname.startsWith("/admin")) {
    const { data: superAdmin } = await supabase
      .from("super_admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!superAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
