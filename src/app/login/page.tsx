"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_start: "Couldn't start the Zotero sign-in. Please try again.",
  oauth_callback: "Zotero sign-in didn't complete. Please try again.",
};

function LoginContent() {
  const params = useSearchParams();
  const router = useRouter();
  const error = params.get("error");
  const message = error ? ERROR_MESSAGES[error] ?? "Sign-in failed." : null;

  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  async function signInWithKey(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim() || submitting) return;
    setSubmitting(true);
    setKeyError(null);
    try {
      const res = await fetch("/api/auth/apikey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      if (!res.ok) {
        setKeyError(
          res.status === 401
            ? "That key didn't work. Double-check you copied it correctly."
            : "Sign-in failed. Please try again.",
        );
        setSubmitting(false);
        return;
      }
      const data = await res.json();
      router.replace(data.destination ?? "/");
    } catch {
      setKeyError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 text-center shadow-xl">
        <h1 className="text-3xl font-bold tracking-tight">Articordle</h1>
        <p className="mt-2 text-sm text-muted">
          A daily game! Guess a random paper from your own Zotero library using
          five clues.
        </p>

        {message && (
          <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {message}
          </p>
        )}

        <a
          href="/api/auth/zotero"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-3 font-semibold text-[#0b1020] transition-opacity hover:opacity-90"
        >
          Sign in with Zotero
        </a>

        <p className="mt-4 text-xs text-muted">
          We only request read access to fetch your papers and generate clues.
        </p>

        <div className="my-6 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={signInWithKey} className="text-left">
          <label htmlFor="apiKey" className="text-sm font-medium">
            Use a Zotero API key
          </label>
          <input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your read-only API key"
            autoComplete="off"
            className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />

          {keyError && (
            <p className="mt-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {keyError}
            </p>
          )}

          <button
            type="submit"
            disabled={!apiKey.trim() || submitting}
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-bg disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in with API key"}
          </button>

          <p className="mt-3 text-xs text-muted">
            Create one at{" "}
            <a
              href="https://www.zotero.org/settings/keys/new"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-accent"
            >
              zotero.org/settings/keys
            </a>
            {" "}then paste that API key here. Read-only access is enough.
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
