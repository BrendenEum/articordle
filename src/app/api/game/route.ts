import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GameStatus, Prisma, type Guess } from "@prisma/client";
import { getUserId } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import {
  cluesFromValues,
  effectiveDate,
  getOrCreateDailyGame,
  MAX_GUESSES,
  TOTAL_CLUES,
  type ClueValues,
} from "@/lib/dailyGame";
import { generatePaperClues } from "@/lib/sync";

interface SerializableGame {
  paperId: string;
  status: GameStatus;
  guessesUsed: number;
  cluesRevealed: number;
  paper: { citation: string; title: string };
  guesses: Guess[];
}

/** Validate a stored JSON value as the five clues, or null if incomplete. */
function readClues(value: unknown): ClueValues | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<ClueValues>;
  if (v.abstract && v.results && v.methods && v.introDiscussion && v.journal) {
    return v as ClueValues;
  }
  return null;
}

/**
 * Return the game's clues, generating them once and persisting them on the game
 * row if not already stored. Returns null if the paper has no readable PDF /
 * the LLM failed (the caller then offers a re-sample).
 */
async function ensureClues(
  gameId: string,
  paperId: string,
  stored: unknown,
): Promise<{ clues: ClueValues | null; reason: "no_pdf" | "llm_error" | null }> {
  const existing = readClues(stored);
  if (existing) return { clues: existing, reason: null };
  const outcome = await generatePaperClues(paperId);
  if (!outcome.ok) return { clues: null, reason: outcome.reason };
  await prisma.dailyGame.update({
    where: { id: gameId },
    data: { clues: outcome.clues as unknown as Prisma.InputJsonValue },
  });
  return { clues: outcome.clues, reason: null };
}

function serialize(
  game: SerializableGame,
  allClues: string[] | null,
  clueError: "no_pdf" | "llm_error" | null = null,
) {
  const finished = game.status !== GameStatus.in_progress;
  const cluesReady = allClues !== null;
  const clues = allClues ?? [];
  const visibleCount = finished ? TOTAL_CLUES : game.cluesRevealed;
  return {
    status: game.status,
    guessesUsed: game.guessesUsed,
    maxGuesses: MAX_GUESSES,
    cluesRevealed: visibleCount,
    totalClues: TOTAL_CLUES,
    cluesReady,
    clueError,
    clues: clues.slice(0, visibleCount),
    guesses: game.guesses
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((g) => ({ guessedPaperId: g.guessedPaperId, correct: g.correct })),
    answer: finished
      ? {
          paperId: game.paperId,
          citation: game.paper.citation,
          title: game.paper.title,
        }
      : null,
  };
}

// GET today's game state (creating it if needed).
export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await getOrCreateDailyGame(userId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  const game = await prisma.dailyGame.findUnique({
    where: { id: result.id },
    include: { paper: true, guesses: true },
  });
  if (!game) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { clues, reason } = await ensureClues(
    game.id,
    game.paperId,
    game.clues,
  );
  return NextResponse.json(
    serialize(game, clues ? cluesFromValues(clues) : null, reason),
  );
}

const guessSchema = z.object({ guessedPaperId: z.string().min(1) });

// POST a guess for today's game.
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = guessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const gameDate = effectiveDate();
  const game = await prisma.dailyGame.findUnique({
    where: { userId_gameDate: { userId, gameDate } },
    include: { paper: true, guesses: true },
  });
  if (!game) {
    return NextResponse.json({ error: "no_game" }, { status: 409 });
  }

  const clues = readClues(game.clues);
  if (game.status !== GameStatus.in_progress) {
    return NextResponse.json(
      serialize(game, clues ? cluesFromValues(clues) : null),
    );
  }
  // Can't guess until the day's clues have been generated.
  if (!clues) {
    return NextResponse.json(serialize(game, null));
  }

  // Validate the guessed paper belongs to this user's library.
  const guessedPaper = await prisma.paper.findFirst({
    where: { id: parsed.data.guessedPaperId, userId },
    select: { id: true },
  });
  if (!guessedPaper) {
    return NextResponse.json({ error: "invalid_guess" }, { status: 400 });
  }

  const correct = guessedPaper.id === game.paperId;
  const guessesUsed = game.guessesUsed + 1;

  let status: GameStatus = GameStatus.in_progress;
  let cluesRevealed = game.cluesRevealed;
  if (correct) {
    status = GameStatus.won;
    cluesRevealed = TOTAL_CLUES;
  } else if (guessesUsed >= MAX_GUESSES) {
    status = GameStatus.lost;
    cluesRevealed = TOTAL_CLUES;
  } else {
    // Reveal one additional clue for the next guess.
    cluesRevealed = Math.min(TOTAL_CLUES, guessesUsed + 1);
  }

  await prisma.guess.create({
    data: {
      dailyGameId: game.id,
      guessedPaperId: guessedPaper.id,
      correct,
    },
  });

  const updated = await prisma.dailyGame.update({
    where: { id: game.id },
    data: { guessesUsed, status, cluesRevealed },
    include: { paper: true, guesses: true },
  });

  return NextResponse.json(serialize(updated, cluesFromValues(clues)));
}
