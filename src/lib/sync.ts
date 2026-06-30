import { prisma } from "./prisma";
import { decrypt } from "./crypto";
import { buildCitation } from "./citation";
import { extractPdfText, isUsableText } from "./pdf";
import { generateClues, type GeneratedClues } from "./gemini";
import {
  downloadAttachment,
  findPdfAttachment,
  listCollectionItems,
  type ZoteroLibrary,
} from "./zotero";

export interface SyncResult {
  total: number;
}

/** Resolve which Zotero library a user (or paper) reads from. */
function resolveLibrary(
  zoteroUserId: string,
  libraryType: string | null,
  libraryId: string | null,
): ZoteroLibrary {
  return {
    type: libraryType === "group" ? "group" : "user",
    id: libraryId ?? zoteroUserId,
  };
}

/**
 * Sync the user's chosen collection into Paper rows (metadata only). This stays
 * lightweight so it completes within a web request even for large collections;
 * a paper's PDF is downloaded and clues are generated on demand via
 * {@link generatePaperClues} when that paper is the day's puzzle.
 */
export async function syncUserLibrary(userId: string): Promise<SyncResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  if (!user.selectedCollectionKey) {
    throw new Error("No collection selected");
  }
  const apiKey = decrypt(user.zoteroApiKeyEnc);
  const library = resolveLibrary(
    user.zoteroUserId,
    user.selectedLibraryType,
    user.selectedLibraryId,
  );
  const items = await listCollectionItems(
    apiKey,
    library,
    user.selectedCollectionKey,
  );

  for (const item of items) {
    const citation = buildCitation(item.creators, item.date);
    const title = item.title || "Untitled";
    await prisma.paper.upsert({
      where: { userId_zoteroItemKey: { userId, zoteroItemKey: item.key } },
      create: {
        userId,
        zoteroItemKey: item.key,
        libraryType: library.type,
        libraryId: library.id,
        title,
        citation,
        journal: item.publicationTitle,
      },
      update: {
        libraryType: library.type,
        libraryId: library.id,
        title,
        citation,
        journal: item.publicationTitle,
      },
    });
  }

  return { total: items.length };
}

/**
 * Generate clues for a single paper on demand: download its PDF, extract text,
 * and ask the LLM for the five clues. Returns an outcome describing success or
 * the reason it failed so the caller can show the right message:
 *   - "no_pdf": the paper has no readable PDF (offer a different paper)
 *   - "llm_error": the clue service failed/was rate-limited (offer a retry)
 * Results are NOT cached here — each call regenerates fresh.
 */
export type ClueOutcome =
  | { ok: true; clues: GeneratedClues }
  | { ok: false; reason: "no_pdf" | "llm_error" };

export async function generatePaperClues(
  paperId: string,
): Promise<ClueOutcome> {
  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
    include: { user: true },
  });
  if (!paper) return { ok: false, reason: "no_pdf" };

  const apiKey = decrypt(paper.user.zoteroApiKeyEnc);
  const library = resolveLibrary(
    paper.user.zoteroUserId,
    paper.libraryType,
    paper.libraryId,
  );

  let text: string;
  try {
    const attachment = await findPdfAttachment(
      apiKey,
      library,
      paper.zoteroItemKey,
    );
    if (!attachment) return { ok: false, reason: "no_pdf" };
    const bytes = await downloadAttachment(apiKey, library, attachment.key);
    text = await extractPdfText(bytes);
  } catch (err) {
    console.error(`PDF fetch failed for paper ${paper.id}:`, err);
    return { ok: false, reason: "no_pdf" };
  }
  if (!isUsableText(text)) return { ok: false, reason: "no_pdf" };

  try {
    const clues = await generateClues({
      title: paper.title,
      fullText: text,
      journalHint: paper.journal,
    });
    return { ok: true, clues };
  } catch (err) {
    console.error(`Clue generation failed for paper ${paper.id}:`, err);
    return { ok: false, reason: "llm_error" };
  }
}
