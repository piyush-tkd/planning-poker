import { create } from "zustand";
import type { Session, Story, Vote } from "@/types/database";

interface SessionState {
  session: Session | null;
  stories: Story[];
  currentStoryIndex: number;
  votes: Record<string, Vote[]>; // storyId -> votes
  participants: { id: string; name: string; avatar_url: string | null; hasVoted: boolean }[];
  timer: number | null; // seconds remaining
  setSession: (session: Session | null) => void;
  setStories: (stories: Story[]) => void;
  setCurrentStoryIndex: (index: number) => void;
  addVote: (storyId: string, vote: Vote) => void;
  setVotes: (storyId: string, votes: Vote[]) => void;
  setParticipants: (participants: SessionState["participants"]) => void;
  updateParticipantVoteStatus: (userId: string, hasVoted: boolean) => void;
  setTimer: (seconds: number | null) => void;
  currentStory: () => Story | null;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  stories: [],
  currentStoryIndex: 0,
  votes: {},
  participants: [],
  timer: null,
  setSession: (session) => set({ session }),
  setStories: (stories) => set({ stories }),
  setCurrentStoryIndex: (currentStoryIndex) => set({ currentStoryIndex }),
  addVote: (storyId, vote) =>
    set((state) => ({
      votes: {
        ...state.votes,
        [storyId]: [...(state.votes[storyId] || []), vote],
      },
    })),
  setVotes: (storyId, votes) =>
    set((state) => ({
      votes: { ...state.votes, [storyId]: votes },
    })),
  setParticipants: (participants) => set({ participants }),
  updateParticipantVoteStatus: (userId, hasVoted) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === userId ? { ...p, hasVoted } : p
      ),
    })),
  setTimer: (timer) => set({ timer }),
  currentStory: () => {
    const { stories, currentStoryIndex } = get();
    return stories[currentStoryIndex] ?? null;
  },
  reset: () =>
    set({
      session: null,
      stories: [],
      currentStoryIndex: 0,
      votes: {},
      participants: [],
      timer: null,
    }),
}));
