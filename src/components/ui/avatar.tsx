import * as React from "react";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}

const colorMap = [
  "bg-indigo-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500", "bg-lime-500",
];

function Avatar({ src, name, size = "md", className, ...props }: AvatarProps) {
  const [imgError, setImgError] = React.useState(false);
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg" };
  const colorIndex = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colorMap.length;

  if (src && !imgError) {
    return (
      <div className={cn("rounded-full overflow-hidden flex-shrink-0", sizes[size], className)} {...props}>
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0",
        sizes[size],
        colorMap[colorIndex],
        className
      )}
      {...props}
    >
      {getInitials(name)}
    </div>
  );
}
export { Avatar };