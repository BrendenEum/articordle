import { NextResponse } from "next/server";
import { getUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

// Current auth/session state used by the client to route between login, setup
// and the game.
export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ authenticated: false });
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({
    authenticated: true,
    username: user.username,
    hasCollection: Boolean(user.selectedCollectionKey),
    selectedCollectionKey: user.selectedCollectionKey,
  });
}
