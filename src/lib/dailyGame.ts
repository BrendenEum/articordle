import crypto from "crypto";
import { GameStatus, type DailyGame, type Paper } from "@prisma/client";
import { prisma } from "./prisma";

export const TOTAL_CLUES = 5;
export const MAX_GUESSES = 5;

/** The player's effective calendar day (UTC) as YYYY-MM-DD. */
export function effectiveDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Stable numeric hash in [0, 2^32) for deterministic ordering. */
function hash(input: string): number {
  const hex = crypto.createHash("sha256").update(input).digest("hex").slice(0, 8);
  return parseInt(hex, 16);
}

/** Deterministic per-day shuffle so the same paper is chosen all day. */
function seededOrder<T extends { id: string }>(items: T[], seed: string): T[] {
  return [...items].sort((a, b) => hash(seed + a.id) - hash(seed + b.id));
}

export interface DailyGameWithRelations extends DailyGame {
  paper: Paper;
}

/**
 * Deterministic per-day ordering of the papers eligible to be today's puzzle:
 * papers not used on a previous day (recycling once all have been used),
 * shuffled stably by a per-user, per-day seed.
 */
async function orderedCandidates(
  userId: string,
  gameDate: string,
): Promise<Paper[]> {
  const papers = await prisma.paper.findMany({ where: { userId } });
  if (papers.length === 0) return [];

  // Exclude papers used on *other* days so today's pick stays a candidate.
  const playedRows = await prisma.dailyGame.findMany({
    where: { userId, gameDate: { not: gameDate } },
    select: { paperId: true },
  });
  const playedIds = new Set(playedRows.map((r) => r.paperId));

  let candidates = papers.filter((p) => !playedIds.has(p.id));
  if (candidates.length === 0) candidates = papers; // recycle once exhausted

  return seededOrder(candidates, `${userId}:${gameDate}`);
}

/**
 * Get (or lazily create) today's game for a user. Deterministically picks one
 * paper for the day (stable all day). Clues are generated once by the caller
 * after creation and stored on the game row; nothing is pre-generated here.
 */
export async function getOrCreateDailyGame(
  userId: string,
): Promise<DailyGameWithRelations | { error: "no_papers" }> {
  const gameDate = effectiveDate();

  const existing = await prisma.dailyGame.findUnique({
    where: { userId_gameDate: { userId, gameDate } },
    include: { paper: true },
  });
  if (existing) return existing as DailyGameWithRelations;

  const ordered = await orderedCandidates(userId, gameDate);
  if (ordered.length === 0) return { error: "no_papers" };

  const created = await prisma.dailyGame.create({
    data: {
      userId,
      gameDate,
      paperId: ordered[0].id,
      status: GameStatus.in_progress,
      guessesUsed: 0,
      cluesRevealed: 1,
    },
    include: { paper: true },
  });
  return created as DailyGameWithRelations;
}

/**
 * Pick the next eligible paper after the current one in today's deterministic
 * order, wrapping around. Used to re-sample when a paper has no readable PDF.
 */
export async function nextPaperForDay(
  userId: string,
  gameDate: string,
  currentPaperId: string,
): Promise<Paper | null> {
  const ordered = await orderedCandidates(userId, gameDate);
  if (ordered.length === 0) return null;
  const idx = ordered.findIndex((p) => p.id === currentPaperId);
  if (idx === -1) return ordered[0];
  return ordered[(idx + 1) % ordered.length];
}

export interface ClueValues {
  abstract: string;
  results: string;
  methods: string;
  introDiscussion: string;
  journal: string;
}

/** Clue strings in reveal order (index 0 = clue box 1). */
export function cluesFromValues(v: ClueValues): string[] {
  return [v.abstract, v.results, v.methods, v.introDiscussion, v.journal];
}
