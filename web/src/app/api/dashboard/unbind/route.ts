/**
 * POST /api/dashboard/unbind
 *
 * 公开接口（无需登录），供 catbus 卸载脚本（--uninstall）调用。
 * 根据 node_id 删除 user_agents 绑定记录，避免账户里残留僵尸节点。
 *
 * Body:  { node_id: string }
 * 200:   { success: true }
 * 404:   { error: "NOT_FOUND" }
 * 400:   { error: "MISSING_NODE_ID" }
 */

import { findUserAgentByNodeId, removeUserAgent } from "@/lib/db";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  let body: { node_id?: string };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const node_id = body?.node_id?.trim();
  if (!node_id) {
    return Response.json({ error: "MISSING_NODE_ID" }, { status: 400 });
  }

  const existing = findUserAgentByNodeId(node_id);
  if (!existing) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  removeUserAgent(node_id);
  return Response.json({ success: true });
}
