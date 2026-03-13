import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { findUserByEmail, findUserById, createUser } from "@/lib/db";

/**
 * POST /api/v2/auth/login
 * Public. Stateless credentials/OAuth check.
 *
 * Supports two flows:
 *   1. { provider: "credentials", email, password }
 *   2. { provider: "github", code }
 *
 * Legacy flat format still accepted: { email, password }
 *
 * NOTE: This endpoint validates credentials and returns user info,
 * but does NOT create a server-side session cookie by itself.
 * For full session login (cookie-based), use NextAuth's built-in
 * POST /api/auth/callback/credentials (via signIn() on the client).
 */
export async function POST(req: NextRequest) {
  let body: {
    provider?: string;
    email?: string;
    password?: string;
    code?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "VALIDATION_ERROR", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const provider = body.provider ?? "credentials";

  // ── GitHub OAuth flow ──────────────────────────────────────────────────────
  if (provider === "github") {
    const code = body.code?.trim();
    if (!code) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "code is required for github provider" },
        { status: 400 }
      );
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return Response.json(
        {
          error: "PROVIDER_UNAVAILABLE",
          message: "GitHub OAuth is not configured on this server",
          // TODO: set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET env vars
        },
        { status: 503 }
      );
    }

    // 1. Exchange code for access token
    let accessToken: string;
    try {
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
      });
      const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
      if (!tokenData.access_token) {
        return Response.json(
          { error: "UNAUTHORIZED", message: tokenData.error ?? "Failed to exchange GitHub code" },
          { status: 401 }
        );
      }
      accessToken = tokenData.access_token;
    } catch {
      return Response.json(
        { error: "UPSTREAM_ERROR", message: "Failed to reach GitHub OAuth endpoint" },
        { status: 502 }
      );
    }

    // 2. Fetch GitHub user profile
    let ghUser: { id: number; login: string; email: string | null; name: string | null };
    try {
      const profileRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
        },
      });
      if (!profileRes.ok) {
        return Response.json(
          { error: "UPSTREAM_ERROR", message: "Failed to fetch GitHub profile" },
          { status: 502 }
        );
      }
      ghUser = await profileRes.json() as typeof ghUser;
    } catch {
      return Response.json(
        { error: "UPSTREAM_ERROR", message: "Failed to reach GitHub API" },
        { status: 502 }
      );
    }

    // 3. Find or create local user by GitHub email (or synthetic placeholder)
    const email = ghUser.email ?? `github_${ghUser.id}@noreply.github.com`;
    let user = findUserByEmail(email);
    if (!user) {
      // Auto-provision account for new GitHub users
      const placeholderHash = await bcrypt.hash(crypto.randomUUID(), 10);
      user = createUser(email, placeholderHash, ghUser.name ?? ghUser.login);
    }

    return Response.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
      },
      message: "GitHub OAuth valid. Use /api/auth/callback/github for session login.",
    });
  }

  // ── Credentials flow (default) ─────────────────────────────────────────────
  if (provider !== "credentials") {
    return Response.json(
      { error: "VALIDATION_ERROR", message: `Unsupported provider: ${provider}` },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return Response.json(
      { error: "VALIDATION_ERROR", message: "email and password are required" },
      { status: 400 }
    );
  }

  const user = findUserByEmail(email);
  if (!user) {
    return Response.json(
      { error: "UNAUTHORIZED", message: "Invalid credentials" },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return Response.json(
      { error: "UNAUTHORIZED", message: "Invalid credentials" },
      { status: 401 }
    );
  }

  return Response.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
    },
    message: "Credentials valid. Use /api/auth/callback/credentials for session login.",
  });
}
