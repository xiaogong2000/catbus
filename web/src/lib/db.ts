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
        created_at TEXT DEFAULT (datetime('now'))
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
      created_at TEXT DEFAULT (datetime('now')),
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

export function removeUserAgent(userId: number, nodeId: string): number {
  ensureAgentsTable();
  const result = getDb().prepare("DELETE FROM user_agents WHERE user_id = ? AND node_id = ?").run(userId, nodeId);
  return result.changes;
}
