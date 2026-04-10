import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "pro" | "enterprise";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-indigo-100 text-indigo-700 border-indigo-200",
    secondary: "bg-slate-100 text-slate-700 border-slate-200",
    destructive: "bg-red-100 text-red-700 border-red-200",
    outline: "bg-transparent border-slate-300 text-slate-700",
    pro: "bg-gradient-to-r from-violet-100 to-indigo-100 text-indigo-700 border-indigo-200",
    enterprise: "bg-gradient-to-r from-amber-100 to-orange-100 text-orange-700 border-orange-200",
  };
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
export { Badge };