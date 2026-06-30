"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface PaperOption {
  id: string;
  citation: string;
  title: string;
}

interface GuessRecord {
  guessedPaperId: string;
  correct: boolean;
}

interface GameState {
  status: "in_progress" | "won" | "lost";
  guessesUsed: number;
  maxGuesses: number;
  cluesRevealed: number;
  totalClues: number;
  cluesReady: boolean;
  clueError: "no_pdf" | "llm_error" | null;
  clues: string[];
  guesses: GuessRecord[];
  answer: { paperId: string; citation: string; title: string } | null;
}

const CLUE_LABELS = [
  "Abstract",
  "Results",
  "Methods",
  "Introduction & Discussion",
  "Journal",
];

export default function Game({ username }: { username: string | null }) {
  const [game, setGame] = useState<GameState | null>(null);
  const [papers, setPapers] = useState<PaperOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PaperOption | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [resampling, setResampling] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [gameRes, papersRes] = await Promise.all([
        fetch("/api/game"),
        fetch("/api/papers"),
      ]);
      setLoadError(null);
      if (papersRes.ok) {
        const data = await papersRes.json();
        setPapers(data.papers ?? []);
      }
      if (gameRes.ok) {
        const data: GameState = await gameRes.json();
        setGame(data);
        if (data.status !== "in_progress") setShowModal(true);
      } else {
        const err = await gameRes.json().catch(() => ({}));
        setLoadError(err.error ?? "load_error");
      }
    } catch {
      setLoadError("network");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Mount-time data fetch; state is only set after awaited responses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const paperById = useMemo(() => {
    const map = new Map<string, PaperOption>();
    for (const p of papers) map.set(p.id, p);
    return map;
  }, [papers]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return papers
      .filter(
        (p) =>
          p.citation.toLowerCase().includes(q) ||
          p.title.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [papers, query]);

  const finished = game ? game.status !== "in_progress" : false;

  function pick(option: PaperOption) {
    setSelected(option);
    setQuery(option.citation);
    setShowSuggestions(false);
  }

  async function resample() {
    setResampling(true);
    try {
      const res = await fetch("/api/game/resample", { method: "POST" });
      if (res.ok) {
        setLoading(true);
        await load();
      }
    } finally {
      setResampling(false);
    }
  }

  async function playAgain() {
    setShowModal(false);
    setSelected(null);
    setQuery("");
    await resample();
  }

  async function submitGuess() {
    if (!selected || submitting || finished) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guessedPaperId: selected.id }),
      });
      if (res.ok) {
        const data: GameState = await res.json();
        setGame(data);
        setSelected(null);
        setQuery("");
        if (data.status !== "in_progress") {
          setShowModal(true);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <CenteredMessage>Loading today&rsquo;s paper&hellip;</CenteredMessage>;
  }

  if (loadError === "no_papers") {
    return (
      <CenteredMessage>
        <p className="mb-3 text-lg font-semibold">No playable paper today</p>
        <p className="max-w-md text-sm text-muted">
          None of the papers in your collection had a readable PDF with usable
          text. Add PDFs to your Zotero items, then{" "}
          <a className="text-accent underline" href="/setup">
            re-sync your collection
          </a>
          .
        </p>
      </CenteredMessage>
    );
  }

  if (loadError === "no_clues") {
    return (
      <CenteredMessage>
        <p className="mb-3 text-lg font-semibold">
          Couldn&rsquo;t generate today&rsquo;s clues
        </p>
        <p className="max-w-md text-sm text-muted">
          Today&rsquo;s paper may be missing a readable PDF, or the clue service
          was briefly unavailable.
        </p>
        <button
          onClick={() => {
            setLoading(true);
            load();
          }}
          className="mt-4 rounded-lg bg-accent px-4 py-2 font-medium text-[#0b1020]"
        >
          Try again
        </button>
      </CenteredMessage>
    );
  }

  if (loadError || !game) {
    return (
      <CenteredMessage>
        <p className="mb-3">Something went wrong loading the game.</p>
        <button
          onClick={() => {
            setLoading(true);
            load();
          }}
          className="rounded-lg bg-accent px-4 py-2 font-medium text-[#0b1020]"
        >
          Retry
        </button>
      </CenteredMessage>
    );
  }

  const guessesLeft = game.maxGuesses - game.guessesUsed;

  if (!game.cluesReady && game.status === "in_progress") {
    if (game.clueError === "llm_error") {
      return (
        <CenteredMessage>
          <p className="mb-3 text-lg font-semibold">
            Couldn&rsquo;t generate today&rsquo;s clues
          </p>
          <p className="max-w-md text-sm text-muted">
            The clue service was busy or rate-limited. Wait a few seconds and
            try again — this keeps today&rsquo;s paper.
          </p>
          <button
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="mt-4 rounded-lg bg-accent px-4 py-2 font-medium text-[#0b1020]"
          >
            Try again
          </button>
        </CenteredMessage>
      );
    }
    return (
      <CenteredMessage>
        <p className="mb-3 text-lg font-semibold">
          Today&rsquo;s paper has no readable PDF
        </p>
        <p className="max-w-md text-sm text-muted">
          We couldn&rsquo;t read a PDF for today&rsquo;s randomly chosen paper,
          so its clues can&rsquo;t be generated. You can try a different paper
          from your collection.
        </p>
        <button
          onClick={resample}
          disabled={resampling}
          className="mt-4 rounded-lg bg-accent px-4 py-2 font-medium text-[#0b1020] disabled:opacity-50"
        >
          {resampling ? "Finding another paper…" : "Try a different paper"}
        </button>
      </CenteredMessage>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Articordle</h1>
          <p className="text-xs text-muted">
            Guess today&rsquo;s paper from your Zotero library
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            {guessesLeft} / {game.maxGuesses} guesses left
          </span>
          <a
            href="/setup"
            className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
          >
            Collection
          </a>
        </div>
      </header>

      {/* Clue boxes */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: game.totalClues }).map((_, i) => {
          const revealed = i < game.clues.length;
          return (
            <div
              key={i}
              className={[
                "rounded-xl border p-4 transition-colors",
                revealed
                  ? "animate-clue-in border-border bg-surface"
                  : "border-dashed border-border/60 bg-surface/30",
              ].join(" ")}
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={[
                    "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold",
                    revealed
                      ? "bg-accent text-[#0b1020]"
                      : "bg-surface-2 text-muted",
                  ].join(" ")}
                >
                  {i + 1}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {CLUE_LABELS[i]}
                </span>
              </div>
              {revealed ? (
                <p className="text-[15px] leading-relaxed text-foreground">
                  {game.clues[i]}
                </p>
              ) : (
                <p className="select-none text-sm italic text-muted/60">
                  Locked &mdash; reveal with your next guess
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Guess history */}
      {game.guesses.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {game.guesses.map((g, idx) => {
            const p = paperById.get(g.guessedPaperId);
            return (
              <div
                key={idx}
                className={[
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                  g.correct
                    ? "border-success/50 bg-success/10 text-success"
                    : "border-danger/40 bg-danger/10 text-foreground",
                ].join(" ")}
              >
                <span>{g.correct ? "✓" : "✗"}</span>
                <span className="truncate">
                  {p ? p.citation : "Unknown paper"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Guess input */}
      {!finished && (
        <div className="relative mt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(null);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (selected) submitGuess();
                    else if (suggestions.length > 0) pick(suggestions[0]);
                  }
                }}
                placeholder="Type to search your papers…"
                className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-sm outline-none focus:border-accent"
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute bottom-full z-10 mb-2 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface-2 shadow-xl">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pick(s);
                        }}
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-surface"
                      >
                        <span className="text-sm font-medium">{s.citation}</span>
                        <span className="line-clamp-1 text-xs text-muted">
                          {s.title}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={submitGuess}
              disabled={!selected || submitting}
              className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-[#0b1020] transition-opacity disabled:opacity-40"
            >
              Guess
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            {selected
              ? "Press Guess to submit."
              : "Pick a paper from the list to enable your guess."}
          </p>
        </div>
      )}

      {/* Play again (persists after the modal is dismissed, so clues stay readable) */}
      {finished && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            onClick={playAgain}
            disabled={resampling}
            className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-[#0b1020] transition-opacity disabled:opacity-50"
          >
            {resampling ? "Loading new paper…" : "Play again"}
          </button>
          <p className="text-xs text-muted">
            Samples a new paper from your collection.
          </p>
        </div>
      )}

      {/* Result modal */}
      {showModal && finished && (
        <Modal onClose={() => setShowModal(false)}>
          <div className="text-center">
            <h2
              className={[
                "mb-2 text-2xl font-bold",
                game.status === "won" ? "text-success" : "text-danger",
              ].join(" ")}
            >
              {game.status === "won" ? "Congratulations!" : "Game over."}
            </h2>
            <p className="mb-4 text-sm text-muted">
              {game.status === "won"
                ? `Solved in ${game.guessesUsed} ${
                    game.guessesUsed === 1 ? "guess" : "guesses"
                  }.`
                : "Better luck tomorrow."}
            </p>
            {game.answer && (
              <div className="mb-4 rounded-lg border border-border bg-surface p-3 text-left">
                <p className="text-[11px] uppercase tracking-wide text-muted">
                  Answer
                </p>
                <p className="font-semibold">{game.answer.citation}</p>
                <p className="text-sm text-muted">{game.answer.title}</p>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                onClick={playAgain}
                disabled={resampling}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#0b1020] transition-opacity disabled:opacity-50"
              >
                {resampling ? "Loading new paper…" : "Play again"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface"
              >
                View all clues
              </button>
            </div>
          </div>
        </Modal>
      )}

      <footer className="mt-auto pt-8 text-center text-[11px] text-muted">
        {username ? `Signed in as ${username} · ` : ""}
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          className="underline hover:text-foreground"
        >
          Sign out
        </button>
        {" · Website managed by "}
        <a
          href="https://brendeneum.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Brenden Eum
        </a>
      </footer>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-muted">
      {children}
    </div>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="animate-pop-in w-full max-w-sm rounded-2xl border border-border bg-surface-2 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
