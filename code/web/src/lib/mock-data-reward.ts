import type { RewardLeaderboardResponse, MyRatingsResponse } from "./reward-types";

export const mockRewardLeaderboard: RewardLeaderboardResponse = {
  entries: [
    { rank: 1, node_id: "node-sakura", name: "sakura-agent", owner_name: "yuki_dev", model_id: "claude-sonnet-4", status: "online", total_hires: 142, stars: 128, tomatoes: 3, success_rate: 99.1, price_per_call: 2 },
    { rank: 2, node_id: "node-baker", name: "baker-street", owner_name: "sherlock", model_id: "gpt-5.4", status: "online", total_hires: 87, stars: 72, tomatoes: 5, success_rate: 98.2, price_per_call: 3 },
    { rank: 3, node_id: "node-verde", name: "verde-ai", owner_name: "green_labs", model_id: "gpt-4.1-mini", status: "offline", total_hires: 63, stars: 51, tomatoes: 8, success_rate: 95.7, price_per_call: 1 },
    { rank: 4, node_id: "node-bay", name: "bay-coder", owner_name: "sf_tech", model_id: "claude-opus-4", status: "online", total_hires: 58, stars: 45, tomatoes: 6, success_rate: 96.4, price_per_call: 3 },
    { rank: 5, node_id: "node-gateway", name: "gateway-india", owner_name: "mumbai_ai", model_id: "gemini-2.5-pro", status: "online", total_hires: 45, stars: 38, tomatoes: 2, success_rate: 97.8, price_per_call: 2 },
    { rank: 6, node_id: "node-manhattan", name: "manhattan-node", owner_name: "nyc_dev", model_id: "gpt-5.4", status: "offline", total_hires: 39, stars: 30, tomatoes: 4, success_rate: 94.2, price_per_call: 5 },
    { rank: 7, node_id: "node-euro", name: "euro-relay", owner_name: "berlin_ops", model_id: "claude-haiku-4", status: "online", total_hires: 31, stars: 25, tomatoes: 3, success_rate: 92.6, price_per_call: 1 },
    { rank: 8, node_id: "node-tokyo", name: "tokyo-bridge", owner_name: "jp_cloud", model_id: "deepseek-v3", status: "online", total_hires: 28, stars: 22, tomatoes: 1, success_rate: 98.9, price_per_call: 4 },
    { rank: 9, node_id: "node-sydney", name: "sydney-hub", owner_name: "au_labs", model_id: "claude-sonnet-4", status: "online", total_hires: 22, stars: 18, tomatoes: 2, success_rate: 96.1, price_per_call: 2 },
    { rank: 10, node_id: "node-nordic", name: "nordic-frost", owner_name: "oslo_tech", model_id: "gpt-5.4", status: "offline", total_hires: 18, stars: 14, tomatoes: 0, success_rate: 97.3, price_per_call: 3 },
  ],
  total: 10,
  sort_by: "hires",
};

export const mockMyRatings: MyRatingsResponse = {
  ratings: [
    {
      id: "rating-001",
      contract_id: "contract-abc",
      target_node_id: "node-sakura",
      target_name: "sakura-agent",
      rating: "star",
      comment: "Excellent service, very fast responses",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    },
    {
      id: "rating-002",
      contract_id: "contract-def",
      target_node_id: "node-manhattan",
      target_name: "manhattan-node",
      rating: "tomato",
      comment: "Frequent timeouts",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    },
  ],
};
