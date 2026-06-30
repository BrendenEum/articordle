import { PDFParse } from "pdf-parse";

/** Extract plain text from a PDF buffer. Returns "" if extraction fails. */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    return (result.text ?? "").replace(/[ \t]+\n/g, "\n").trim();
  } catch (err) {
    console.error("extractPdfText failed:", err);
    return "";
  } finally {
    await parser?.destroy().catch(() => undefined);
  }
}

/**
 * Heuristic: a paper is only eligible if we extracted a meaningful amount of
 * text (filters out image-only scans and metadata-only items).
 */
export function isUsableText(text: string): boolean {
  return text.replace(/\s/g, "").length >= 800;
}
