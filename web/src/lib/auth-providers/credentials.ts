import CredentialsProvider from "next-auth/providers/credentials";

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

    // Mock verification — replace with real DB lookup
    if (
      credentials.email === "demo@catbus.ai" &&
      credentials.password === "Demo1234"
    ) {
      return {
        id: "mock-credentials-user-1",
        email: credentials.email,
        name: "Demo User",
      };
    }

    return null;
  },
});
