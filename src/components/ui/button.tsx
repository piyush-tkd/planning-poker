import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variants = {
      default: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
      destructive: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
      outline: "border border-slate-300 bg-white hover:bg-slate-50 text-slate-700",
      secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
      ghost: "hover:bg-slate-100 text-slate-700",
      link: "text-indigo-600 underline-offset-4 hover:underline",
    };
    const sizes = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-8 px-3 text-xs rounded-md",
      lg: "h-12 px-8 text-base rounded-lg",
      icon: "h-10 w-10",
    };
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
export { Button };