import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { env } from "./env";

export interface SessionData {
  /** Set once the user has authenticated with Zotero. */
  userId?: string;
  /** Temporary OAuth 1.0a request-token secret, held only during the flow. */
  oauthTokenSecret?: string;
  oauthToken?: string;
}

export const sessionOptions: SessionOptions = {
  password: env.sessionSecret,
  cookieName: "articordle_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
