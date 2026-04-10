import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function generateSessionCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export const FIBONACCI = ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?", "☕"];
export const T_SHIRT = ["XS", "S", "M", "L", "XL", "XXL", "?", "☕"];

/**
 * Strips common Jira wiki markup from a string so descriptions
 * from imported Jira issues render as clean plain text.
 */
export function stripJiraMarkup(text: string): string {
  return text
    // Remove Atlassian headings: h1. h2. etc at start of line
    .replace(/^h[1-6]\.\s*/gm, "")
    // Bold/italic: *text* and _text_
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // Monospace/code: {{text}}
    .replace(/\{\{([^}]+)\}\}/g, "`$1`")
    // Jira macros: {code}, {noformat}, {panel} etc
    .replace(/\{[a-z:=|]+\}/gi, "")
    // Jira list markers: #* #** * ** at line start → just trim them
    .replace(/^[#*]+\s*/gm, "• ")
    // Hyperlinks: [text|url] or [url]
    .replace(/\[([^\]|]+)\|[^\]]+\]/g, "$1")
    .replace(/\[([^\]]+)\]/g, "$1")
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const PLAN_LIMITS = {
  free:       { teams: 1,  membersPerTeam: 10, sessions: -1, customCards: false, jiraIntegration: false, analytics: false, auditLog: false, exportData: false, guestJoin: true },
  pro:        { teams: 10, membersPerTeam: 50, sessions: -1, customCards: true,  jiraIntegration: true,  analytics: true,  auditLog: false, exportData: true,  guestJoin: true },
  enterprise: { teams: -1, membersPerTeam: -1, sessions: -1, customCards: true,  jiraIntegration: true,  analytics: true,  auditLog: true,  exportData: true,  guestJoin: true  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;
