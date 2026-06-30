import { getSession } from "./session";

/** Returns the authenticated user's id, or null if not signed in. */
export async function getUserId(): Promise<string | null> {
  const session = await getSession();
  return session.userId ?? null;
}
