import { NextResponse } from "next/server";
import { getUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

// Autocomplete options for guessing: all papers in the synced collection.
export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const papers = await prisma.paper.findMany({
    where: { userId },
    select: { id: true, citation: true, title: true },
    orderBy: { citation: "asc" },
  });
  return NextResponse.json({ papers });
}
