import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import {
  findUserById,
  getUserAgents,
  getUserSettings,
  upsertUserSettings,
  updateUserName,
} from "@/lib/db";

/**
 * GET /api/v2/dashboard/settings
 * Auth required. Returns user profile + notification preferences + bound agents.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const user = findUserById(auth.userId);
  if (!user) {
    return Response.json(
      { error: "NOT_FOUND", message: "User not found" },
      { status: 404 }
    );
  }

  const settings = getUserSettings(auth.userId);
  const agents = getUserAgents(auth.userId);

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
    },
    github_username: settings?.github_username ?? null,
    notifications: {
      agent_offline_email: settings ? Boolean(settings.notify_agent_offline) : true,
      daily_report: settings ? Boolean(settings.notify_daily_report) : false,
      weekly_report: settings ? Boolean(settings.notify_weekly_report) : false,
    },
    bound_agents: agents.map((a) => ({
      node_id: a.node_id,
      name: a.name,
      registered_at: a.created_at,
    })),
  });
}

/**
 * PATCH /api/v2/dashboard/settings
 * Auth required. Updates user profile and/or notification preferences.
 * Body (all optional):
 *   name: string
 *   github_username: string
 *   notifications: { agent_offline_email?, daily_report?, weekly_report? }
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  let body: {
    name?: string;
    github_username?: string;
    notifications?: {
      agent_offline_email?: boolean;
      daily_report?: boolean;
      weekly_report?: boolean;
    };
  };

  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "VALIDATION_ERROR", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (body.name !== undefined) {
    updateUserName(auth.userId, body.name.trim());
  }

  const settingsUpdate: {
    github_username?: string;
    notify_agent_offline?: number;
    notify_daily_report?: number;
    notify_weekly_report?: number;
  } = {};
  let hasSettingsUpdate = false;

  if (body.github_username !== undefined) {
    settingsUpdate.github_username = body.github_username.trim();
    hasSettingsUpdate = true;
  }
  if (body.notifications) {
    const n = body.notifications;
    if (n.agent_offline_email !== undefined) {
      settingsUpdate.notify_agent_offline = n.agent_offline_email ? 1 : 0;
      hasSettingsUpdate = true;
    }
    if (n.daily_report !== undefined) {
      settingsUpdate.notify_daily_report = n.daily_report ? 1 : 0;
      hasSettingsUpdate = true;
    }
    if (n.weekly_report !== undefined) {
      settingsUpdate.notify_weekly_report = n.weekly_report ? 1 : 0;
      hasSettingsUpdate = true;
    }
  }

  if (hasSettingsUpdate) {
    upsertUserSettings(auth.userId, settingsUpdate);
  }

  return Response.json({ success: true });
}
