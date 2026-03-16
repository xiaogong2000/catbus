// Demo showcase data: 36 nodes across 30+ countries, 18 skills, active hire relationships

export interface DemoNode {
  node_id: string;
  name: string;
  skills: string[];
  status: "online" | "offline";
  uptime_seconds: number;
  connected_at: number;
  last_heartbeat: number;
  connected_from: string;
  geo: { lat: number; lng: number; city: string; country: string };
}

const NOW = Date.now() / 1000;

export const DEMO_NODES: DemoNode[] = [
  // Asia
  { node_id: "n-tokyo-01", name: "sakura-agent", skills: ["translate", "summarize", "web_search", "ocr"], status: "online", uptime_seconds: 86400, connected_at: NOW - 86400, last_heartbeat: NOW, connected_from: "103.5.140.1", geo: { lat: 35.68, lng: 139.69, city: "Tokyo", country: "Japan" } },
  { node_id: "n-osaka-01", name: "namba-coder", skills: ["code_gen", "test_gen", "debug"], status: "online", uptime_seconds: 72000, connected_at: NOW - 72000, last_heartbeat: NOW, connected_from: "103.5.141.2", geo: { lat: 34.69, lng: 135.50, city: "Osaka", country: "Japan" } },
  { node_id: "n-seoul-01", name: "hallyu-agent", skills: ["translate", "image_gen", "ocr", "sentiment"], status: "online", uptime_seconds: 54000, connected_at: NOW - 54000, last_heartbeat: NOW, connected_from: "121.78.100.1", geo: { lat: 37.57, lng: 126.98, city: "Seoul", country: "South Korea" } },
  { node_id: "n-beijing-01", name: "dragon-node", skills: ["translate", "code_gen", "web_search", "summarize"], status: "online", uptime_seconds: 43200, connected_at: NOW - 43200, last_heartbeat: NOW, connected_from: "123.125.71.1", geo: { lat: 39.90, lng: 116.40, city: "Beijing", country: "China" } },
  { node_id: "n-shanghai-01", name: "bund-ai", skills: ["data_analysis", "chart_gen", "ml_train"], status: "online", uptime_seconds: 36000, connected_at: NOW - 36000, last_heartbeat: NOW, connected_from: "180.163.0.1", geo: { lat: 31.23, lng: 121.47, city: "Shanghai", country: "China" } },
  { node_id: "n-singapore-01", name: "merlion-hub", skills: ["routing", "load_balance", "health_check", "find_skills"], status: "online", uptime_seconds: 90000, connected_at: NOW - 90000, last_heartbeat: NOW, connected_from: "203.208.40.1", geo: { lat: 1.35, lng: 103.82, city: "Singapore", country: "Singapore" } },
  { node_id: "n-bangalore-01", name: "silk-road", skills: ["translate", "ocr", "classify", "summarize"], status: "online", uptime_seconds: 64800, connected_at: NOW - 64800, last_heartbeat: NOW, connected_from: "49.207.0.1", geo: { lat: 12.97, lng: 77.59, city: "Bangalore", country: "India" } },
  { node_id: "n-mumbai-01", name: "gateway-india", skills: ["web_search", "news_feed", "sentiment"], status: "online", uptime_seconds: 48000, connected_at: NOW - 48000, last_heartbeat: NOW, connected_from: "103.21.0.1", geo: { lat: 19.08, lng: 72.88, city: "Mumbai", country: "India" } },
  { node_id: "n-jakarta-01", name: "nusantara-bot", skills: ["translate", "data_analysis"], status: "online", uptime_seconds: 28800, connected_at: NOW - 28800, last_heartbeat: NOW, connected_from: "36.86.0.1", geo: { lat: -6.20, lng: 106.85, city: "Jakarta", country: "Indonesia" } },
  { node_id: "n-taipei-01", name: "formosa-ai", skills: ["code_review", "translate", "summarize"], status: "online", uptime_seconds: 57600, connected_at: NOW - 57600, last_heartbeat: NOW, connected_from: "61.216.0.1", geo: { lat: 25.03, lng: 121.57, city: "Taipei", country: "Taiwan" } },

  // Europe
  { node_id: "n-london-01", name: "baker-street", skills: ["code_review", "debug", "explain", "security_scan"], status: "online", uptime_seconds: 82800, connected_at: NOW - 82800, last_heartbeat: NOW, connected_from: "81.2.69.1", geo: { lat: 51.51, lng: -0.13, city: "London", country: "UK" } },
  { node_id: "n-berlin-01", name: "europa-bot", skills: ["translate", "sentiment", "classify"], status: "online", uptime_seconds: 75600, connected_at: NOW - 75600, last_heartbeat: NOW, connected_from: "91.216.0.1", geo: { lat: 52.52, lng: 13.41, city: "Berlin", country: "Germany" } },
  { node_id: "n-paris-01", name: "lumiere-ai", skills: ["image_gen", "style_transfer", "translate"], status: "online", uptime_seconds: 68400, connected_at: NOW - 68400, last_heartbeat: NOW, connected_from: "82.66.0.1", geo: { lat: 48.86, lng: 2.35, city: "Paris", country: "France" } },
  { node_id: "n-amsterdam-01", name: "canal-compute", skills: ["data_analysis", "ml_train", "chart_gen"], status: "online", uptime_seconds: 61200, connected_at: NOW - 61200, last_heartbeat: NOW, connected_from: "145.0.0.1", geo: { lat: 52.37, lng: 4.90, city: "Amsterdam", country: "Netherlands" } },
  { node_id: "n-stockholm-01", name: "nordic-node", skills: ["code_gen", "refactor", "test_gen"], status: "online", uptime_seconds: 50400, connected_at: NOW - 50400, last_heartbeat: NOW, connected_from: "185.195.0.1", geo: { lat: 59.33, lng: 18.07, city: "Stockholm", country: "Sweden" } },
  { node_id: "n-zurich-01", name: "alpine-engine", skills: ["security_scan", "code_review", "explain"], status: "online", uptime_seconds: 43200, connected_at: NOW - 43200, last_heartbeat: NOW, connected_from: "178.238.0.1", geo: { lat: 47.38, lng: 8.54, city: "Zurich", country: "Switzerland" } },
  { node_id: "n-moscow-01", name: "ural-compute", skills: ["data_analysis", "ml_train"], status: "offline", uptime_seconds: 0, connected_at: NOW - 172800, last_heartbeat: NOW - 3600, connected_from: "95.163.0.1", geo: { lat: 55.76, lng: 37.62, city: "Moscow", country: "Russia" } },
  { node_id: "n-madrid-01", name: "sol-agent", skills: ["translate", "web_search", "news_feed"], status: "online", uptime_seconds: 39600, connected_at: NOW - 39600, last_heartbeat: NOW, connected_from: "88.26.0.1", geo: { lat: 40.42, lng: -3.70, city: "Madrid", country: "Spain" } },

  // North America
  { node_id: "n-sf-01", name: "bay-coder", skills: ["code_gen", "test_gen", "refactor", "deploy"], status: "online", uptime_seconds: 93600, connected_at: NOW - 93600, last_heartbeat: NOW, connected_from: "104.16.0.1", geo: { lat: 37.77, lng: -122.42, city: "San Francisco", country: "United States" } },
  { node_id: "n-ny-01", name: "manhattan-ops", skills: ["code_review", "security_scan", "deploy", "explain"], status: "online", uptime_seconds: 79200, connected_at: NOW - 79200, last_heartbeat: NOW, connected_from: "74.6.0.1", geo: { lat: 40.71, lng: -74.01, city: "New York", country: "United States" } },
  { node_id: "n-la-01", name: "hollywood-ai", skills: ["image_gen", "style_transfer", "video_gen"], status: "online", uptime_seconds: 64800, connected_at: NOW - 64800, last_heartbeat: NOW, connected_from: "23.80.0.1", geo: { lat: 34.05, lng: -118.24, city: "Los Angeles", country: "United States" } },
  { node_id: "n-toronto-01", name: "maple-node", skills: ["translate", "summarize", "classify"], status: "online", uptime_seconds: 54000, connected_at: NOW - 54000, last_heartbeat: NOW, connected_from: "99.229.0.1", geo: { lat: 43.65, lng: -79.38, city: "Toronto", country: "Canada" } },
  { node_id: "n-austin-01", name: "lone-star", skills: ["code_gen", "debug", "web_search"], status: "online", uptime_seconds: 46800, connected_at: NOW - 46800, last_heartbeat: NOW, connected_from: "72.182.0.1", geo: { lat: 30.27, lng: -97.74, city: "Austin", country: "United States" } },
  { node_id: "n-mexico-01", name: "aztec-bot", skills: ["translate", "ocr", "sentiment"], status: "online", uptime_seconds: 32400, connected_at: NOW - 32400, last_heartbeat: NOW, connected_from: "187.174.0.1", geo: { lat: 19.43, lng: -99.13, city: "Mexico City", country: "Mexico" } },

  // South America
  { node_id: "n-saopaulo-01", name: "verde-ai", skills: ["translate", "text_stats", "data_analysis"], status: "online", uptime_seconds: 57600, connected_at: NOW - 57600, last_heartbeat: NOW, connected_from: "200.147.0.1", geo: { lat: -23.55, lng: -46.63, city: "São Paulo", country: "Brazil" } },
  { node_id: "n-buenos-01", name: "tango-node", skills: ["translate", "summarize", "news_feed"], status: "online", uptime_seconds: 36000, connected_at: NOW - 36000, last_heartbeat: NOW, connected_from: "190.216.0.1", geo: { lat: -34.60, lng: -58.38, city: "Buenos Aires", country: "Argentina" } },
  { node_id: "n-santiago-01", name: "andes-compute", skills: ["data_analysis", "chart_gen"], status: "offline", uptime_seconds: 0, connected_at: NOW - 86400, last_heartbeat: NOW - 7200, connected_from: "200.27.0.1", geo: { lat: -33.45, lng: -70.67, city: "Santiago", country: "Chile" } },

  // Middle East & Africa
  { node_id: "n-dubai-01", name: "oasis-node", skills: ["web_search", "news_feed", "summarize", "translate"], status: "online", uptime_seconds: 72000, connected_at: NOW - 72000, last_heartbeat: NOW, connected_from: "94.200.0.1", geo: { lat: 25.20, lng: 55.27, city: "Dubai", country: "UAE" } },
  { node_id: "n-telaviv-01", name: "startup-agent", skills: ["code_gen", "security_scan", "deploy"], status: "online", uptime_seconds: 43200, connected_at: NOW - 43200, last_heartbeat: NOW, connected_from: "31.154.0.1", geo: { lat: 32.09, lng: 34.78, city: "Tel Aviv", country: "Israel" } },
  { node_id: "n-cairo-01", name: "sphinx-bot", skills: ["translate", "web_search"], status: "offline", uptime_seconds: 0, connected_at: NOW - 259200, last_heartbeat: NOW - 14400, connected_from: "41.33.0.1", geo: { lat: 30.04, lng: 31.24, city: "Cairo", country: "Egypt" } },
  { node_id: "n-lagos-01", name: "sahel-ai", skills: ["translate", "news_feed", "sentiment"], status: "online", uptime_seconds: 21600, connected_at: NOW - 21600, last_heartbeat: NOW, connected_from: "105.112.0.1", geo: { lat: 6.52, lng: 3.38, city: "Lagos", country: "Nigeria" } },
  { node_id: "n-nairobi-01", name: "savanna-node", skills: ["translate", "data_analysis"], status: "online", uptime_seconds: 18000, connected_at: NOW - 18000, last_heartbeat: NOW, connected_from: "41.90.0.1", geo: { lat: -1.29, lng: 36.82, city: "Nairobi", country: "Kenya" } },
  { node_id: "n-capetown-01", name: "cape-compute", skills: ["ml_train", "data_analysis", "chart_gen"], status: "online", uptime_seconds: 28800, connected_at: NOW - 28800, last_heartbeat: NOW, connected_from: "41.0.0.1", geo: { lat: -33.93, lng: 18.42, city: "Cape Town", country: "South Africa" } },

  // Oceania
  { node_id: "n-sydney-01", name: "outback-ai", skills: ["data_analysis", "chart_gen", "ml_train"], status: "online", uptime_seconds: 50400, connected_at: NOW - 50400, last_heartbeat: NOW, connected_from: "203.0.178.1", geo: { lat: -33.87, lng: 151.21, city: "Sydney", country: "Australia" } },
  { node_id: "n-melbourne-01", name: "yarra-bot", skills: ["code_review", "explain", "debug"], status: "online", uptime_seconds: 39600, connected_at: NOW - 39600, last_heartbeat: NOW, connected_from: "103.2.0.1", geo: { lat: -37.81, lng: 144.96, city: "Melbourne", country: "Australia" } },
  { node_id: "n-auckland-01", name: "kiwi-agent", skills: ["translate", "summarize"], status: "online", uptime_seconds: 14400, connected_at: NOW - 14400, last_heartbeat: NOW, connected_from: "103.11.0.1", geo: { lat: -36.85, lng: 174.76, city: "Auckland", country: "New Zealand" } },
];

export const DEMO_SKILLS = [
  { name: "translate", description: "Translate text between 50+ languages", providers: 12 },
  { name: "code_gen", description: "Generate production-ready code from natural language", providers: 7 },
  { name: "summarize", description: "Summarize long text, articles, and documents", providers: 8 },
  { name: "web_search", description: "Search the web and return structured results", providers: 6 },
  { name: "code_review", description: "Review code for bugs, security, and best practices", providers: 5 },
  { name: "data_analysis", description: "Analyze datasets and extract insights", providers: 6 },
  { name: "image_gen", description: "Generate images from text descriptions", providers: 3 },
  { name: "debug", description: "Diagnose and fix code issues", providers: 4 },
  { name: "ml_train", description: "Train and fine-tune machine learning models", providers: 4 },
  { name: "ocr", description: "Extract text from images and documents", providers: 4 },
  { name: "sentiment", description: "Analyze sentiment and emotion in text", providers: 4 },
  { name: "classify", description: "Classify text into categories", providers: 3 },
  { name: "chart_gen", description: "Generate charts and visualizations from data", providers: 4 },
  { name: "security_scan", description: "Scan code and infrastructure for vulnerabilities", providers: 4 },
  { name: "deploy", description: "Deploy applications to cloud infrastructure", providers: 3 },
  { name: "news_feed", description: "Aggregate and filter news from multiple sources", providers: 4 },
  { name: "test_gen", description: "Generate unit and integration tests", providers: 3 },
  { name: "style_transfer", description: "Apply artistic styles to images", providers: 2 },
];

export const DEMO_STATS = {
  online_nodes: DEMO_NODES.filter((n) => n.status === "online").length,
  total_skills: DEMO_SKILLS.length,
  total_capabilities: DEMO_NODES.reduce((sum, n) => sum + n.skills.length, 0),
  calls_today: 12847,
  calls_total: 1_283_491,
  avg_latency_ms: 142,
  uptime_seconds: 2_592_000, // 30 days
};
