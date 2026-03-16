import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "users.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  return db;
}

export interface DbUser {
  id: number;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: string;
}

export function findUserByEmail(email: string): DbUser | undefined {
  return getDb().prepare("SELECT * FROM users WHERE email = ?").get(email) as DbUser | undefined;
}

export function createUser(email: string, passwordHash: string, name?: string): DbUser {
  const stmt = getDb().prepare(
    "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)"
  );
  stmt.run(email, passwordHash, name || null);
  return findUserByEmail(email)!;
}

export function findUserById(id: number): DbUser | undefined {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as DbUser | undefined;
}

export function updateUserName(userId: number, name: string): void {
  getDb().prepare("UPDATE users SET name = ? WHERE id = ?").run(name, userId);
}

// --- User settings ---

function ensureSettingsTable(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      github_username TEXT,
      notify_agent_offline INTEGER DEFAULT 1,
      notify_daily_report INTEGER DEFAULT 0,
      notify_weekly_report INTEGER DEFAULT 0
    )
  `);
}

export interface UserSettings {
  user_id: number;
  github_username: string | null;
  notify_agent_offline: number;
  notify_daily_report: number;
  notify_weekly_report: number;
}

export function getUserSettings(userId: number): UserSettings | undefined {
  ensureSettingsTable();
  return getDb().prepare("SELECT * FROM user_settings WHERE user_id = ?").get(userId) as UserSettings | undefined;
}

export function upsertUserSettings(userId: number, settings: Partial<Omit<UserSettings, "user_id">>): void {
  ensureSettingsTable();
  const existing = getUserSettings(userId);
  if (!existing) {
    const cols = ["user_id", ...Object.keys(settings)];
    const placeholders = cols.map(() => "?").join(", ");
    getDb().prepare(`INSERT INTO user_settings (${cols.join(", ")}) VALUES (${placeholders})`).run(userId, ...Object.values(settings));
  } else {
    const sets = Object.keys(settings).map((k) => `${k} = ?`).join(", ");
    getDb().prepare(`UPDATE user_settings SET ${sets} WHERE user_id = ?`).run(...Object.values(settings), userId);
  }
}

// --- User agents ---

function ensureAgentsTable(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS user_agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      node_id TEXT NOT NULL,
      name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, node_id)
    )
  `);
}

export interface UserAgent {
  id: number;
  user_id: number;
  node_id: string;
  name: string | null;
  created_at: string;
}

export function getUserAgents(userId: number): UserAgent[] {
  ensureAgentsTable();
  return getDb().prepare("SELECT * FROM user_agents WHERE user_id = ?").all(userId) as UserAgent[];
}

export function addUserAgent(userId: number, nodeId: string, name?: string): UserAgent {
  ensureAgentsTable();
  getDb().prepare("INSERT OR IGNORE INTO user_agents (user_id, node_id, name) VALUES (?, ?, ?)").run(userId, nodeId, name || null);
  return getDb().prepare("SELECT * FROM user_agents WHERE user_id = ? AND node_id = ?").get(userId, nodeId) as UserAgent;
}

export function renameUserAgent(userId: number, nodeId: string, name: string): number {
  ensureAgentsTable();
  const result = getDb().prepare('UPDATE user_agents SET name = ? WHERE user_id = ? AND node_id = ?').run(name, userId, nodeId);
  return result.changes;
}

export function removeUserAgent(userId: number, nodeId: string): number {
  ensureAgentsTable();
  const result = getDb().prepare("DELETE FROM user_agents WHERE user_id = ? AND node_id = ?").run(userId, nodeId);
  return result.changes;
}

export function removeUserAgentByNodeId(nodeId: string): number {
  ensureAgentsTable();
  const result = getDb().prepare("DELETE FROM user_agents WHERE node_id = ?").run(nodeId);
  return result.changes;
}

// ─── Bind Tokens ───────────────────────────────────────────

function ensureBindTokensTable(): void {
  getDb().exec(`CREATE TABLE IF NOT EXISTS bind_tokens (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    used INTEGER DEFAULT 0,
    bound_node_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL
  )`);
}

export interface BindToken {
  id: string;
  user_id: number;
  used: number;
  bound_node_id: string | null;
  created_at: string;
  expires_at: string;
}

export function createBindToken(userId: number): BindToken {
  ensureBindTokensTable();
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  getDb().prepare("INSERT INTO bind_tokens (id, user_id, expires_at) VALUES (?, ?, ?)").run(id, userId, expiresAt);
  return getDb().prepare("SELECT * FROM bind_tokens WHERE id = ?").get(id) as BindToken;
}

export function getBindToken(id: string): BindToken | undefined {
  ensureBindTokensTable();
  return getDb().prepare("SELECT * FROM bind_tokens WHERE id = ?").get(id) as BindToken | undefined;
}

export function useBindToken(id: string, nodeId: string): boolean {
  ensureBindTokensTable();
  const now = new Date().toISOString();
  const result = getDb().prepare(
    "UPDATE bind_tokens SET used = 1, bound_node_id = ? WHERE id = ? AND used = 0 AND expires_at > ?"
  ).run(nodeId, id, now);
  return result.changes > 0;
}

// ─── Hire Config ───────────────────────────────────────────

function ensureHireConfigTable(): void {
  getDb().exec(`CREATE TABLE IF NOT EXISTS hire_config (
    node_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    available INTEGER DEFAULT 0,
    price_per_call INTEGER DEFAULT 0,
    max_concurrent INTEGER DEFAULT 1,
    skills TEXT DEFAULT '[]',
    description TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
}

export interface HireConfig {
  node_id: string;
  user_id: number;
  available: number;
  price_per_call: number;
  max_concurrent: number;
  skills: string;
  description: string | null;
  updated_at: string;
}

export function getHireConfig(nodeId: string): HireConfig | undefined {
  ensureHireConfigTable();
  return getDb().prepare("SELECT * FROM hire_config WHERE node_id = ?").get(nodeId) as HireConfig | undefined;
}

export function upsertHireConfig(userId: number, nodeId: string, data: Partial<Omit<HireConfig, "node_id" | "user_id">>): HireConfig {
  ensureHireConfigTable();
  const existing = getHireConfig(nodeId);
  const now = new Date().toISOString();
  if (!existing) {
    getDb().prepare(
      "INSERT INTO hire_config (node_id, user_id, available, price_per_call, max_concurrent, skills, description, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(nodeId, userId, data.available ?? 0, data.price_per_call ?? 0, data.max_concurrent ?? 1, data.skills ?? "[]", data.description ?? null, now);
  } else {
    const sets = Object.keys(data).map(k => `${k} = ?`).join(", ");
    getDb().prepare(`UPDATE hire_config SET ${sets}, updated_at = ? WHERE node_id = ?`).run(...Object.values(data), now, nodeId);
  }
  return getDb().prepare("SELECT * FROM hire_config WHERE node_id = ?").get(nodeId) as HireConfig;
}

export function getAvailableHireConfigs(page: number, limit: number, skill?: string): { data: HireConfig[], total: number } {
  ensureHireConfigTable();
  let where = "WHERE available = 1";
  const params: unknown[] = [];
  if (skill) { where += " AND skills LIKE ?"; params.push(`%${skill}%`); }
  const total = (getDb().prepare(`SELECT COUNT(*) as n FROM hire_config ${where}`).get(...params) as { n: number }).n;
  const offset = (page - 1) * limit;
  const data = getDb().prepare(`SELECT * FROM hire_config ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as HireConfig[];
  return { data, total };
}

// ─── Hire Requests ─────────────────────────────────────────

function ensureHireRequestsTable(): void {
  getDb().exec(`CREATE TABLE IF NOT EXISTS hire_requests (
    id TEXT PRIMARY KEY,
    requester_id INTEGER NOT NULL REFERENCES users(id),
    node_id TEXT NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT DEFAULT 'pending',
    message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
}

export interface HireRequest {
  id: string;
  requester_id: number;
  node_id: string;
  owner_id: number;
  status: string;
  message: string | null;
  created_at: string;
  updated_at: string;
}

export function createHireRequest(requesterId: number, nodeId: string, ownerId: number, message?: string): HireRequest {
  ensureHireRequestsTable();
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const now = new Date().toISOString();
  getDb().prepare("INSERT INTO hire_requests (id, requester_id, node_id, owner_id, message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, requesterId, nodeId, ownerId, message ?? null, now, now);
  return getDb().prepare("SELECT * FROM hire_requests WHERE id = ?").get(id) as HireRequest;
}

export function getHireRequestsByRequester(requesterId: number): HireRequest[] {
  ensureHireRequestsTable();
  return getDb().prepare("SELECT * FROM hire_requests WHERE requester_id = ? ORDER BY created_at DESC").all(requesterId) as HireRequest[];
}

export function getHireRequestsByOwner(ownerId: number): HireRequest[] {
  ensureHireRequestsTable();
  return getDb().prepare("SELECT * FROM hire_requests WHERE owner_id = ? ORDER BY created_at DESC").all(ownerId) as HireRequest[];
}

export function updateHireRequestStatus(id: string, ownerId: number, status: "approved" | "rejected"): HireRequest | undefined {
  ensureHireRequestsTable();
  const now = new Date().toISOString();
  getDb().prepare("UPDATE hire_requests SET status = ?, updated_at = ? WHERE id = ? AND owner_id = ?").run(status, now, id, ownerId);
  return getDb().prepare("SELECT * FROM hire_requests WHERE id = ?").get(id) as HireRequest | undefined;
}

// ─── Hire Contracts ────────────────────────────────────────

function ensureHireContractsTable(): void {
  getDb().exec(`CREATE TABLE IF NOT EXISTS hire_contracts (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    requester_id INTEGER NOT NULL REFERENCES users(id),
    node_id TEXT NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT DEFAULT 'active',
    hired_at TEXT DEFAULT CURRENT_TIMESTAMP,
    terminated_at TEXT
  )`);
}

export interface HireContract {
  id: string;
  request_id: string;
  requester_id: number;
  node_id: string;
  owner_id: number;
  status: string;
  hired_at: string;
  terminated_at: string | null;
}

export function createHireContract(requestId: string, requesterId: number, nodeId: string, ownerId: number): HireContract {
  ensureHireContractsTable();
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const now = new Date().toISOString();
  getDb().prepare("INSERT INTO hire_contracts (id, request_id, requester_id, node_id, owner_id, hired_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, requestId, requesterId, nodeId, ownerId, now);
  return getDb().prepare("SELECT * FROM hire_contracts WHERE id = ?").get(id) as HireContract;
}

export function getContractsByRequester(requesterId: number): HireContract[] {
  ensureHireContractsTable();
  return getDb().prepare("SELECT * FROM hire_contracts WHERE requester_id = ? AND status = 'active' ORDER BY hired_at DESC").all(requesterId) as HireContract[];
}

export function getContractsByOwner(ownerId: number): HireContract[] {
  ensureHireContractsTable();
  return getDb().prepare("SELECT * FROM hire_contracts WHERE owner_id = ? ORDER BY hired_at DESC").all(ownerId) as HireContract[];
}

export function terminateContract(id: string, userId: number): boolean {
  ensureHireContractsTable();
  const now = new Date().toISOString();
  const result = getDb().prepare(
    "UPDATE hire_contracts SET status = 'terminated', terminated_at = ? WHERE id = ? AND (requester_id = ? OR owner_id = ?) AND status = 'active'"
  ).run(now, id, userId, userId);
  return result.changes > 0;
}

export function terminateContractsByOwner(ownerId: number, nodeId: string): void {
  ensureHireContractsTable();
  const now = new Date().toISOString();
  getDb().prepare(
    "UPDATE hire_contracts SET status = 'terminated', terminated_at = ? WHERE owner_id = ? AND node_id = ? AND status = 'active'"
  ).run(now, ownerId, nodeId);
}

// ─── Earnings (stub — populate once earnings tracking is implemented) ───

export function getEarningsAggregated(_userId: number) {
  return {
    today: { credits: 0, tasks: 0 },
    this_week: { credits: 0, tasks: 0 },
    this_month: { credits: 0, tasks: 0 },
    total: { credits: 0, tasks: 0 },
  };
}

export function getEarningsHistory(_userId: number, page: number, limit: number) {
  return { data: [] as Array<{ date: string; credits: number; tasks: number }>, total: 0, page, limit };
}

export function getUserRank(_userId: number): { rank: number; total_tasks: number; total_credits: number; success_rate: number } | null {
  return null;
}
