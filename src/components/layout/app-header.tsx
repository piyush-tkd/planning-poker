"use client";
import { useAuthStore } from "@/store/auth-store";
import { Badge } from "@/components/ui/badge";
import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AppHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function AppHeader({ title, description, actions }: AppHeaderProps) {
  const { currentOrg } = useAuthStore();
  const plan = currentOrg?.plan ?? "free";

  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {plan !== "free" && (
            <Badge variant={plan === "pro" ? "pro" : "enterprise"} className="text-[10px]">
              {plan.toUpperCase()}
            </Badge>
          )}
        </div>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      <div className="flex items-center gap-4">
        {actions}
        <button className="relative p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-600 rounded-full" />
        </button>
      </div>
    </header>
  );
}