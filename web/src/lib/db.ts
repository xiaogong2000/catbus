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
      );

      CREATE TABLE IF NOT EXISTS user_agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        node_id TEXT NOT NULL,
        name TEXT NOT NULL,
        bound_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, node_id)
      );
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
  const result = stmt.run(email, passwordHash, name || null);
  return findUserByEmail(email)!;
}

// ─── user_agents ────────────────────────────────────────────

export interface DbUserAgent {
  id: number;
  user_id: number;
  node_id: string;
  name: string;
  bound_at: string;
}

/**
 * 根据 node_id 查找绑定记录（全局查，不限 user_id）
 * 用于公开解绑接口：节点卸载时只有 node_id 可用
 */
export function findUserAgentByNodeId(node_id: string): DbUserAgent | undefined {
  return getDb()
    .prepare("SELECT * FROM user_agents WHERE node_id = ? LIMIT 1")
    .get(node_id) as DbUserAgent | undefined;
}

/**
 * 删除绑定记录（按 node_id，不限 user_id）
 * 返回实际删除的行数
 */
export function removeUserAgent(node_id: string): number {
  const result = getDb()
    .prepare("DELETE FROM user_agents WHERE node_id = ?")
    .run(node_id);
  return result.changes;
}
