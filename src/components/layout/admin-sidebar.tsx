"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, Building2, Users, CreditCard, Shield, Activity,
  ArrowLeft, LogOut, Zap
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/users", label: "All Users", icon: Users },
  { href: "/admin/plans", label: "Plan Management", icon: CreditCard },
  { href: "/admin/activity", label: "Platform Activity", icon: Activity },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isSuperAdmin } = useAuthStore();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <aside className="fixed left-0 top-0 z-30 h-screen w-64 border-r border-red-100 bg-white flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center gap-2 px-6 border-b border-red-100">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-rose-600 flex items-center justify-center text-white font-bold text-sm">
          P
        </div>
        <span className="text-xl font-bold text-slate-900">
          Point<span className="text-red-600">It</span>
        </span>
        <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] ml-1">ADMIN</Badge>
      </div>

      {/* Super Admin Badge */}
      <div className="px-4 py-3 border-b border-red-50">
        <div className="flex items-center gap-3 rounded-lg bg-red-50 px-3 py-2">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-900">Super Admin</p>
            <p className="text-xs text-red-600">Platform Control Panel</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-red-50 text-red-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "text-red-600" : "text-slate-400")} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Divider + back to app */}
        <div className="pt-4 mt-4 border-t border-slate-100">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-slate-400" />
            <span>Back to App</span>
          </Link>
        </div>
      </nav>

      {/* User */}
      <div className="border-t border-red-100 p-4">
        <div className="flex items-center gap-3 px-2">
          <Avatar name={user?.name ?? "Admin"} src={user?.avatar_url} size="sm" />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900 truncate">{user?.name ?? "Admin"}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email ?? ""}</p>
          </div>
          <button onClick={handleSignOut} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
