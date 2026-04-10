"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  position?: "below" | "above" | "auto";
}

function DropdownMenu({ trigger, children, align = "right", position = "auto" }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [resolvedPosition, setResolvedPosition] = React.useState<"above" | "below">("below");
  const ref = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Auto-detect position when opening
  React.useEffect(() => {
    if (!open || position !== "auto" || !ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = 200; // estimated menu height

    if (spaceBelow < menuHeight && rect.top > menuHeight) {
      setResolvedPosition("above");
    } else {
      setResolvedPosition("below");
    }
  }, [open, position]);

  const finalPosition = position === "auto" ? resolvedPosition : position;

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          ref={menuRef}
          className={cn(
            "absolute z-50 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg",
            finalPosition === "above" ? "bottom-full mb-2" : "top-full mt-2",
            align === "right" ? "right-0" : "left-0"
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownMenuItem({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-slate-200" />;
}

export { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator };
