export type Role = "admin" | "scrum_master" | "member" | "observer";
export type Plan = "free" | "pro" | "enterprise";
export type SessionStatus = "active" | "completed" | "cancelled";
export type VoteStatus = "voting" | "revealed";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_limits: Record<string, number | boolean>;
  feature_flags: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  card_deck: string; // 'fibonacci' | 'tshirt' | 'custom'
  custom_cards: string[] | null;
  jira_project_key: string | null;
  created_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: Role;
  display_name: string;
  avatar_url: string | null;
  email: string;
  joined_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  org_member_id: string;
  role: Role;
  joined_at: string;
}

export interface Session {
  id: string;
  team_id: string;
  name: string;
  join_code: string;
  join_token: string | null;
  status: SessionStatus;
  card_deck: string;
  custom_cards: string[] | null;
  created_by: string;
  created_at: string;
  ended_at: string | null;
}

export interface Story {
  id: string;
  session_id: string;
  title: string;
  description: string | null;
  jira_key: string | null;
  sequence: number;
  final_estimate: string | null;
  vote_status: VoteStatus;
  sent_back_to_bsa: boolean;
  bsa_note: string | null;
  created_at: string;
}

export interface Vote {
  id: string;
  story_id: string;
  user_id: string;
  display_name: string;
  value: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  org_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SuperAdmin {
  id: string;
  user_id: string;
  email: string;
  created_at: string;
}
