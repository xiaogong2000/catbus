import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { findUserByEmail } from "@/lib/db";

export const credentialsProvider = CredentialsProvider({
  name: "Email",
  credentials: {
    email: { label: "Email", type: "email", placeholder: "you@example.com" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    if (!credentials?.email || !credentials?.password) {
      return null;
    }

    const user = findUserByEmail(credentials.email);
    if (!user) return null;

    const valid = await bcrypt.compare(credentials.password, user.password_hash);
    if (!valid) return null;

    return {
      id: String(user.id),
      email: user.email,
      name: user.name || user.email.split("@")[0],
    };
  },
});
