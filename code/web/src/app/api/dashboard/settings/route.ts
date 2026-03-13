import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import {
  findUserById,
  getUserAgents,
  getUserSettings,
  upsertUserSettings,
  updateUserName,
} from "@/lib/db";

// GET /api/dashboard/settings
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
    github_username: settings?.github_username ?? null,
    email: user.email,
    notifications: {
      agent_offline_email: settings ? Boolean(settings.notify_agent_offline) : true,
      daily_report: settings ? Boolean(settings.notify_daily_report) : false,
      weekly_report: settings ? Boolean(settings.notify_weekly_report) : false,
    },
    bound_agents: agents.map((a) => ({
      node_id: a.node_id,
      name: a.name,
    })),
  });
}

// PATCH /api/dashboard/settings
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  let body: {
    github_username?: string;
    name?: string;
    notifications?: {
      agent_offline_email?: boolean;
      daily_report?: boolean;
      weekly_report?: boolean;
    };
  };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "VALIDATION_ERROR", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Update user name if provided
  if (body.name !== undefined) {
    updateUserName(auth.userId, body.name);
  }

  // Build settings update
  const settingsUpdate: {
    github_username?: string;
    notify_agent_offline?: number;
    notify_daily_report?: number;
    notify_weekly_report?: number;
  } = {};
  let hasSettingsUpdate = false;

  if (body.github_username !== undefined) {
    settingsUpdate.github_username = body.github_username;
    hasSettingsUpdate = true;
  }
  if (body.notifications) {
    if (body.notifications.agent_offline_email !== undefined) {
      settingsUpdate.notify_agent_offline = body.notifications.agent_offline_email ? 1 : 0;
      hasSettingsUpdate = true;
    }
    if (body.notifications.daily_report !== undefined) {
      settingsUpdate.notify_daily_report = body.notifications.daily_report ? 1 : 0;
      hasSettingsUpdate = true;
    }
    if (body.notifications.weekly_report !== undefined) {
      settingsUpdate.notify_weekly_report = body.notifications.weekly_report ? 1 : 0;
      hasSettingsUpdate = true;
    }
  }

  if (hasSettingsUpdate) {
    upsertUserSettings(auth.userId, settingsUpdate);
  }

  return Response.json({ success: true });
}
