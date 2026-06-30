import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requestBaseUrl } from "@/lib/requestUrl";
import { getAuthorizeUrl, getRequestToken } from "@/lib/zotero";

// Begin the Zotero OAuth 1.0a flow: get a request token, stash its secret in the
// session, and redirect the user to Zotero to authorize.
export async function GET(req: NextRequest) {
  // Derive the callback host from this request so it matches the host the
  // session cookie is set on; otherwise the request-token secret is lost.
  const baseUrl = requestBaseUrl(req);
  try {
    const callbackUrl = `${baseUrl}/api/auth/zotero/callback`;
    const { token, tokenSecret } = await getRequestToken(callbackUrl);

    const session = await getSession();
    session.oauthToken = token;
    session.oauthTokenSecret = tokenSecret;
    await session.save();

    return NextResponse.redirect(getAuthorizeUrl(token));
  } catch (err) {
    console.error("Zotero OAuth start failed:", err);
    return NextResponse.redirect(`${baseUrl}/login?error=oauth_start`);
  }
}
