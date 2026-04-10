import { create } from "zustand";
import type { Organization, OrgMember, Role } from "@/types/database";

interface AuthState {
  user: { id: string; email: string; name: string; avatar_url: string | null } | null;
  currentOrg: Organization | null;
  membership: OrgMember | null;
  organizations: Organization[];
  isSuperAdmin: boolean;
  isLoading: boolean;
  setUser: (user: AuthState["user"]) => void;
  setCurrentOrg: (org: Organization | null) => void;
  setMembership: (membership: OrgMember | null) => void;
  setOrganizations: (orgs: Organization[]) => void;
  setIsSuperAdmin: (isSuperAdmin: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  role: () => Role | null;
  isAdmin: () => boolean;
  isScrumMaster: () => boolean;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  currentOrg: null,
  membership: null,
  organizations: [],
  isSuperAdmin: false,
  isLoading: true,
  setUser: (user) => set({ user }),
  setCurrentOrg: (currentOrg) => set({ currentOrg }),
  setMembership: (membership) => set({ membership }),
  setOrganizations: (organizations) => set({ organizations }),
  setIsSuperAdmin: (isSuperAdmin) => set({ isSuperAdmin }),
  setIsLoading: (isLoading) => set({ isLoading }),
  role: () => get().membership?.role ?? null,
  isAdmin: () => get().membership?.role === "admin",
  isScrumMaster: () => get().membership?.role === "scrum_master",
  clear: () => set({ user: null, currentOrg: null, membership: null, organizations: [], isSuperAdmin: false, isLoading: false }),
}));
