import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { GameStatus } from "@prisma/client";
import { getUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { effectiveDate, nextPaperForDay } from "@/lib/dailyGame";
import { generatePaperClues } from "@/lib/sync";

// Re-sample today's paper: pick the next eligible paper and (re)generate its
// clues, resetting the game to a fresh start. Used both when the current paper
// has no readable PDF and for "Play again" after a game ends. Disallowed only
// mid-game (in progress with guesses already made) so it can't be used to dodge
// a hard puzzle.
export async function POST() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const gameDate = effectiveDate();
  const game = await prisma.dailyGame.findUnique({
    where: { userId_gameDate: { userId, gameDate } },
  });
  if (!game) {
    return NextResponse.json({ error: "no_game" }, { status: 409 });
  }
  if (game.status === GameStatus.in_progress && game.guessesUsed > 0) {
    return NextResponse.json({ error: "already_started" }, { status: 409 });
  }

  const next = await nextPaperForDay(userId, gameDate, game.paperId);
  if (!next) {
    return NextResponse.json({ error: "no_papers" }, { status: 409 });
  }

  const outcome = await generatePaperClues(next.id);
  // Reset the game to a fresh start on the newly sampled paper.
  await prisma.guess.deleteMany({ where: { dailyGameId: game.id } });
  await prisma.dailyGame.update({
    where: { id: game.id },
    data: {
      paperId: next.id,
      status: GameStatus.in_progress,
      guessesUsed: 0,
      cluesRevealed: 1,
      clues: outcome.ok
        ? (outcome.clues as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
    },
  });

  // cluesReady tells the client whether the new paper produced usable clues.
  return NextResponse.json({
    ok: true,
    cluesReady: outcome.ok,
    reason: outcome.ok ? null : outcome.reason,
  });
}
