import GoogleProvider from "next-auth/providers/google";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.warn("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET — Google OAuth disabled");
}

export const googleProvider = clientId && clientSecret
  ? GoogleProvider({ clientId, clientSecret })
  : null;
