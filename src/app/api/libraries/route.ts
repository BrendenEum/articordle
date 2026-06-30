import { NextResponse } from "next/server";
import { getUserId } from "@/lib/apiAuth";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { listGroups } from "@/lib/zotero";

// List the libraries the player can choose from: their personal library plus
// any Zotero group libraries their API key can read.
export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const apiKey = decrypt(user.zoteroApiKeyEnc);
    const groups = await listGroups(apiKey, user.zoteroUserId);
    const libraries = [
      {
        type: "user" as const,
        id: user.zoteroUserId,
        name: user.username ? `${user.username} (My Library)` : "My Library",
      },
      ...groups
        .map((g) => ({ type: "group" as const, id: g.id, name: g.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ];
    return NextResponse.json({ libraries });
  } catch (err) {
    console.error("Listing libraries failed:", err);
    return NextResponse.json({ error: "zotero_error" }, { status: 502 });
  }
}
