"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth-store";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setUser, setCurrentOrg, setMembership, setOrganizations, setIsSuperAdmin, setIsLoading } = useAuthStore();
  const supabase = createClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        setUser({
          id: user.id,
          email: user.email ?? "",
          name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          avatar_url: user.user_metadata?.avatar_url || null,
        });

        // Check if super admin
        const { data: superAdmin } = await supabase
          .from("super_admins")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (superAdmin) {
          setIsSuperAdmin(true);
        }

        // Load org memberships
        const { data: memberships } = await supabase
          .from("org_members")
          .select("*, organizations(*)")
          .eq("user_id", user.id);

        if (memberships && memberships.length > 0) {
          const orgs = memberships.map((m: any) => m.organizations);
          setOrganizations(orgs);
          setCurrentOrg(orgs[0]);
          setMembership(memberships[0]);
        }
      } catch (error) {
        console.error("Auth error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT") {
          useAuthStore.getState().clear();
          router.push("/login");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}