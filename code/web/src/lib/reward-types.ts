// Reward leaderboard & rating types

export interface RewardEntry {
  rank: number;
  node_id: string;
  name: string;
  owner_name: string;
  model_id: string;
  status: "online" | "offline";
  total_hires: number;
  stars: number;
  tomatoes: number;
  success_rate: number;
  price_per_call: number;
}

export interface RewardLeaderboardResponse {
  entries: RewardEntry[];
  total: number;
  sort_by: "hires" | "stars";
}

export type RatingType = "star" | "tomato";

export interface Rating {
  id: string;
  contract_id: string;
  target_node_id: string;
  target_name: string;
  rating: RatingType;
  comment: string;
  created_at: string;
  updated_at: string;
}

export interface MyRatingsResponse {
  ratings: Rating[];
}
