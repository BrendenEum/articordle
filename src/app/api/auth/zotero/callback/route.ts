import { NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getAccessToken } from "@/lib/zotero";

// OAuth callback: exchange the authorized request token for the permanent API
// key, create/update the user, and start a session.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const oauthToken = url.searchParams.get("oauth_token");
  const verifier = url.searchParams.get("oauth_verifier");

  const session = await getSession();
  const tokenSecret = session.oauthTokenSecret;

  if (!oauthToken || !verifier || !tokenSecret) {
    return NextResponse.redirect(`${env.appBaseUrl}/login?error=oauth_callback`);
  }

  try {
    const access = await getAccessToken(oauthToken, tokenSecret, verifier);

    const user = await prisma.user.upsert({
      where: { zoteroUserId: access.userId },
      create: {
        zoteroUserId: access.userId,
        username: access.username,
        zoteroApiKeyEnc: encrypt(access.apiKey),
      },
      update: {
        username: access.username,
        zoteroApiKeyEnc: encrypt(access.apiKey),
      },
    });

    session.userId = user.id;
    session.oauthToken = undefined;
    session.oauthTokenSecret = undefined;
    await session.save();

    const destination = user.selectedCollectionKey ? "/" : "/setup";
    return NextResponse.redirect(`${env.appBaseUrl}${destination}`);
  } catch (err) {
    console.error("Zotero OAuth callback failed:", err);
    return NextResponse.redirect(`${env.appBaseUrl}/login?error=oauth_callback`);
  }
}
