import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/apiAuth";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { listCollections, type ZoteroLibrary } from "@/lib/zotero";

/** Build a ZoteroLibrary from params, defaulting to the personal library. */
function libraryFromParams(
  zoteroUserId: string,
  type: string | null,
  id: string | null,
): ZoteroLibrary {
  if (type === "group" && id) {
    return { type: "group", id };
  }
  return { type: "user", id: zoteroUserId };
}

// List the collections in a chosen library (defaults to the personal library).
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const library = libraryFromParams(
    user.zoteroUserId,
    url.searchParams.get("libraryType"),
    url.searchParams.get("libraryId"),
  );
  try {
    const apiKey = decrypt(user.zoteroApiKeyEnc);
    const collections = await listCollections(apiKey, library);
    collections.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ collections });
  } catch (err) {
    console.error("Listing collections failed:", err);
    return NextResponse.json({ error: "zotero_error" }, { status: 502 });
  }
}

const selectSchema = z.object({
  collectionKey: z.string().min(1),
  libraryType: z.enum(["user", "group"]).optional(),
  libraryId: z.string().min(1).optional(),
});

// Choose the library + collection to play from.
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = selectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const library = libraryFromParams(
    user.zoteroUserId,
    parsed.data.libraryType ?? null,
    parsed.data.libraryId ?? null,
  );
  await prisma.user.update({
    where: { id: userId },
    data: {
      selectedLibraryType: library.type,
      selectedLibraryId: library.id,
      selectedCollectionKey: parsed.data.collectionKey,
    },
  });
  return NextResponse.json({ ok: true });
}
