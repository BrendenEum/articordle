import {
  GoogleGenerativeAI,
  SchemaType,
  type GenerationConfig,
  type ResponseSchema,
} from "@google/generative-ai";
import { z } from "zod";
import { env } from "./env";

export interface GeneratedClues {
  abstract: string;
  results: string;
  methods: string;
  introDiscussion: string;
  journal: string;
}

const cluesSchema = z.object({
  abstract: z.string().min(1),
  results: z.string().min(1),
  methods: z.string().min(1),
  introDiscussion: z.string().min(1),
  journal: z.string().min(1),
});

const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    abstract: {
      type: SchemaType.STRING,
      description:
        "Three average-length sentences summarizing the entire abstract.",
    },
    results: {
      type: SchemaType.STRING,
      description:
        "Three average-length sentences summarizing the entire results section.",
    },
    methods: {
      type: SchemaType.STRING,
      description:
        "Three average-length sentences summarizing all methods (data, model, and/or experiment).",
    },
    introDiscussion: {
      type: SchemaType.STRING,
      description:
        "Three average-length sentences summarizing the introduction and discussion.",
    },
    journal: {
      type: SchemaType.STRING,
      description: "The full name of the journal the article was published in.",
    },
  },
  required: ["abstract", "results", "methods", "introDiscussion", "journal"],
};

const SYSTEM_PROMPT = `You generate clues for a daily "guess the academic paper" game (like Wordle for papers). A player reads your clues and tries to identify the exact paper.

Given the full text of one paper, produce exactly five fields:
1. "abstract": THREE average-length sentences summarizing the ENTIRE abstract.
2. "results": THREE average-length sentences summarizing the ENTIRE results section.
3. "methods": THREE average-length sentences summarizing ALL methods (data, model, and/or experiment).
4. "introDiscussion": THREE average-length sentences summarizing the introduction AND discussion together.
5. "journal": the FULL name of the journal the article was published in.

Critical rules:
- For fields 1-4, write exactly three clear, average-length sentences each (not one long run-on sentence). Keep them readable and well-punctuated.
- For fields 1-4, DO NOT reveal the paper's title verbatim, the authors' names, or the journal name. Describe the work generically so it remains a fair guessing challenge.
- Do NOT use phrases like "this paper" repeatedly; vary phrasing naturally.
- "journal" must be ONLY the journal's full name (e.g. "Nature Neuroscience"), nothing else. If the journal is unknown, use the provided hint or your best inference.
- Return ONLY the JSON object.`;

const MAX_TEXT_CHARS = 100_000;

export async function generateClues(args: {
  title: string;
  fullText: string;
  journalHint?: string;
}): Promise<GeneratedClues> {
  const genAI = new GoogleGenerativeAI(env.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: env.geminiModel,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.4,
      // Disable "thinking" on 2.5 models: clue summarization doesn't need it,
      // and leaving it on makes each call take ~30s instead of a few seconds.
      thinkingConfig: { thinkingBudget: 0 },
    } as unknown as GenerationConfig,
  });

  const text = args.fullText.slice(0, MAX_TEXT_CHARS);
  const prompt = `${SYSTEM_PROMPT}

PAPER TITLE (for your context only; do not reveal it): ${args.title}
KNOWN JOURNAL HINT (may be blank): ${args.journalHint ?? ""}

PAPER FULL TEXT:
"""
${text}
"""`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Gemini returned non-JSON output: ${raw.slice(0, 300)}`);
  }

  const validated = cluesSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Gemini output failed validation: ${validated.error.message}`,
    );
  }

  const clues = validated.data;
  // Prefer the reliable Zotero metadata journal when present.
  if (args.journalHint && args.journalHint.trim().length > 0) {
    clues.journal = args.journalHint.trim();
  }
  return clues;
}
