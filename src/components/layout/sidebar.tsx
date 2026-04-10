"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, Users, Settings, BarChart3, Shield, UserCircle, LogOut,
  ChevronDown, Plus, Spade, Crown, BookOpen, Menu, X
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "scrum_master", "member", "observer"] },
  { href: "/teams", label: "Teams", icon: Users, roles: ["admin", "scrum_master", "member", "observer"] },
  { href: "/analytics", label: "Analytics", icon: BarChart3, roles: ["admin", "scrum_master"], pro: true },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
  { href: "/audit-log", label: "Audit Log", icon: Shield, roles: ["admin"], enterprise: true },
  { href: "/guide", label: "User Guide", icon: BookOpen, roles: ["admin", "scrum_master", "member", "observer"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, currentOrg, membership, isSuperAdmin } = useAuthStore();
  const role = membership?.role ?? "member";
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const sidebarContent = (
    <aside className="h-full flex flex-col bg-white">
      {/* Logo */}
      <div className="h-16 flex items-center gap-2 px-6 border-b border-slate-200 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
          P
        </div>
        <span className="text-xl font-bold text-slate-900">
          Point<span className="text-indigo-600">It</span>
        </span>
        {/* Mobile close */}
        <button
          className="ml-auto md:hidden p-1 rounded-lg text-slate-400 hover:text-slate-600"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Org Selector */}
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <DropdownMenu
          align="left"
          trigger={
            <button className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 transition">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm">
                {currentOrg?.name?.[0] ?? "O"}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-slate-900 truncate">{currentOrg?.name ?? "My Organization"}</p>
                <p className="text-xs text-slate-500 capitalize">{currentOrg?.plan ?? "free"} plan</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
          }
        >
          <div className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Organizations</div>
          <DropdownMenuItem>
            <div className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-semibold">
              {currentOrg?.name?.[0] ?? "O"}
            </div>
            <span>{currentOrg?.name ?? "My Organization"}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Plus className="h-4 w-4" />
            <span>Create Organization</span>
          </DropdownMenuItem>
        </DropdownMenu>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "text-indigo-600" : "text-slate-400")} />
              <span className="flex-1">{item.label}</span>
              {item.pro && <Badge variant="pro" className="text-[10px] px-1.5 py-0">PRO</Badge>}
              {item.enterprise && <Badge variant="enterprise" className="text-[10px] px-1.5 py-0">ENT</Badge>}
            </Link>
          );
        })}
      </nav>

      {/* Super Admin Link */}
      {isSuperAdmin && (
        <div className="px-3 pb-2 shrink-0">
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
          >
            <Crown className="h-5 w-5 text-red-600" />
            <span>Super Admin</span>
            <Badge className="ml-auto bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0">SA</Badge>
          </Link>
        </div>
      )}

      {/* User */}
      <div className="border-t border-slate-200 p-4 shrink-0">
        <DropdownMenu
          align="left"
          position="above"
          trigger={
            <button className="w-full flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 transition">
              <Avatar name={user?.name ?? "User"} src={user?.avatar_url} size="sm" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-slate-900 truncate">{user?.name ?? "User"}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email ?? ""}</p>
              </div>
            </button>
          }
        >
          <DropdownMenuItem>
            <UserCircle className="h-4 w-4" />
            <Link href="/profile">Profile</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 hover:bg-red-50 cursor-pointer"
            onClick={async () => {
              const { createClient } = await import("@/lib/supabase/client");
              const supabase = createClient();
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
    </aside>
  );

  return (
    <>
      {/* ── Mobile hamburger ─────────────────────────────── */}
      <button
        className="fixed top-3.5 left-4 z-50 md:hidden p-2 rounded-lg bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5 text-slate-600" />
      </button>

      {/* ── Mobile overlay ───────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ────────────────────────────────── */}
      <div
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-64 border-r border-slate-200 shadow-xl transition-transform duration-300 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </div>

      {/* ── Desktop sidebar (always visible) ─────────────── */}
      <div className="hidden md:block fixed left-0 top-0 z-30 h-screen w-64 border-r border-slate-200">
        {sidebarContent}
      </div>
    </>
  );
}
