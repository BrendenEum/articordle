import type { ZoteroCreator } from "./zotero";

/** Pull a 4-digit year out of a free-form Zotero date string. */
export function extractYear(date: string): string {
  const match = date.match(/\d{4}/);
  return match ? match[0] : "n.d.";
}

/**
 * Render a citation as `Last1, Last2, Last3, ... (YEAR)` using only author last
 * names separated by commas (no "and"), per the game's required format.
 */
export function buildCitation(creators: ZoteroCreator[], date: string): string {
  const authors = creators.filter((c) => c.creatorType === "author");
  const chosen = authors.length > 0 ? authors : creators;
  const names = chosen
    .map((c) => (c.lastName?.trim() || c.name?.trim() || ""))
    .filter((n) => n.length > 0);
  const year = extractYear(date);
  if (names.length === 0) {
    return `Unknown (${year})`;
  }
  return `${names.join(", ")} (${year})`;
}
