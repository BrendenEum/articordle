import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { getAuthorizeUrl, getRequestToken } from "@/lib/zotero";

// Begin the Zotero OAuth 1.0a flow: get a request token, stash its secret in the
// session, and redirect the user to Zotero to authorize.
export async function GET() {
  try {
    const callbackUrl = `${env.appBaseUrl}/api/auth/zotero/callback`;
    const { token, tokenSecret } = await getRequestToken(callbackUrl);

    const session = await getSession();
    session.oauthToken = token;
    session.oauthTokenSecret = tokenSecret;
    await session.save();

    return NextResponse.redirect(getAuthorizeUrl(token));
  } catch (err) {
    console.error("Zotero OAuth start failed:", err);
    return NextResponse.redirect(`${env.appBaseUrl}/login?error=oauth_start`);
  }
}
