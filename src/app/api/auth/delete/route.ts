import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Permanently delete the signed-in user. Papers, clues, games and guesses are
// removed via cascading deletes.
export async function POST() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  await prisma.user.deleteMany({ where: { id: session.userId } });
  session.destroy();
  return NextResponse.json({ ok: true });
}
