import GitHubProvider from "next-auth/providers/github";

const clientId = process.env.GITHUB_CLIENT_ID;
const clientSecret = process.env.GITHUB_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.warn("Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET — GitHub OAuth disabled");
}

export const githubProvider = clientId && clientSecret
  ? GitHubProvider({ clientId, clientSecret })
  : null;
