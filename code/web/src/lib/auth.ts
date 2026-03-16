import type { NextAuthOptions } from "next-auth";
import {
  githubProvider,
  googleProvider,
  credentialsProvider,
} from "./auth-providers";
import { findUserByEmail, createUser } from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    githubProvider,
    googleProvider,
    credentialsProvider,
  ].filter(Boolean) as NextAuthOptions["providers"],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        // Credentials provider already returns local DB id
        if (account?.provider === "credentials") {
          token.id = user.id;
        } else {
          // OAuth user — find or create local DB record
          const email = user.email;
          if (email) {
            let dbUser = findUserByEmail(email);
            if (!dbUser) {
              // Create local user with a random password hash (OAuth-only)
              const randomHash = `oauth_${account?.provider}_${Date.now()}`;
              dbUser = createUser(email, randomHash, user.name || undefined);
            }
            token.id = String(dbUser.id);
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
};
