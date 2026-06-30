import { NextResponse } from "next/server";
import { getUserId } from "@/lib/apiAuth";
import { syncUserLibrary } from "@/lib/sync";

// Sync the chosen collection's papers (metadata) into the database.
export async function POST() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncUserLibrary(userId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Sync failed:", err);
    const message =
      err instanceof Error && err.message === "No collection selected"
        ? "no_collection"
        : "sync_error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// Maximum duration hint for platforms that support it.
export const maxDuration = 60;
