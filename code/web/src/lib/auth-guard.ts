import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function requireAuth(): Promise<
  { userId: number } | Response
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json(
      { error: "UNAUTHORIZED", message: "Authentication required" },
      { status: 401 }
    );
  }
  const userId = Number((session.user as { id?: string }).id);
  if (!userId || isNaN(userId)) {
    return Response.json(
      { error: "UNAUTHORIZED", message: "Invalid session" },
      { status: 401 }
    );
  }
  return { userId };
}
