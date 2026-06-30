import { NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { verifyApiKey } from "@/lib/zotero";

// Sign in with a personal Zotero API key (read-only is fine). Verifies the key
// against the Zotero API, then creates/updates the user and starts a session.
export async function POST(req: NextRequest) {
  let apiKey: string | undefined;
  try {
    const body = await req.json();
    apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: "missing_key" }, { status: 400 });
  }

  try {
    const access = await verifyApiKey(apiKey);

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

    const session = await getSession();
    session.userId = user.id;
    await session.save();

    const destination = user.selectedCollectionKey ? "/" : "/setup";
    return NextResponse.json({ ok: true, destination });
  } catch (err) {
    console.error("Zotero API key sign-in failed:", err);
    return NextResponse.json({ error: "invalid_key" }, { status: 401 });
  }
}
