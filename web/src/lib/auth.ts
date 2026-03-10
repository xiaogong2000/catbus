import type { NextAuthOptions } from "next-auth";
import {
  githubProvider,
  googleProvider,
  credentialsProvider,
} from "./auth-providers";

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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
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
