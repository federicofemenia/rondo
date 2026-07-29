export type PlayerRating = {
  conduct: number;
  skill: number;
  comment?: string;
};

export type ChatMessage = {
  author: string;
  text: string;
};

export type MatchEntity = {
  id: string;
  sport: string;
  modality: string;
  minPlayers: string;
  maxPlayers: string;
  positions: string[];
  clubName: string;
  courtName: string | null;
  date: string;
  time: string | null;
  bookingId: string | null;
  invitedCandidates: string[];
  participants: string[];
  chatMessages: ChatMessage[];
  matchFinished: boolean;
  ratings: Record<string, PlayerRating>;
  createdAt: number;
};

export type BookingEntity = {
  id: string;
  clubName: string;
  courtName: string;
  courtSubtitle: string;
  dateLabel: string;
  time: string;
  matchId: string | null;
  createdAt: number;
};
