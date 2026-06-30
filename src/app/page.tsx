import { redirect } from "next/navigation";
import Game from "@/components/Game";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    redirect("/login");
  }
  if (!user.selectedCollectionKey) {
    redirect("/setup");
  }
  return <Game username={user.username} />;
}
