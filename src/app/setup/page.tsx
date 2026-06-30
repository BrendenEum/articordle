"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Library {
  type: "user" | "group";
  id: string;
  name: string;
}

interface Collection {
  key: string;
  name: string;
  parentCollection: string | false;
}

type Phase =
  | "loadingLibraries"
  | "chooseLibrary"
  | "loadingCollections"
  | "choose"
  | "syncing"
  | "error";

export default function SetupPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loadingLibraries");
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [library, setLibrary] = useState<Library | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadCollections = useCallback(
    async (lib: Library) => {
      setPhase("loadingCollections");
      setErrorMsg(null);
      setSelectedKey(null);
      setFilter("");
      try {
        const params = new URLSearchParams({
          libraryType: lib.type,
          libraryId: lib.id,
        });
        const res = await fetch(`/api/collections?${params.toString()}`);
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) {
          setErrorMsg("Couldn't load collections for that library.");
          setPhase("error");
          return;
        }
        const data = await res.json();
        setCollections(data.collections ?? []);
        setPhase("choose");
      } catch {
        setErrorMsg("Network error loading collections.");
        setPhase("error");
      }
    },
    [router],
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/libraries");
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) {
          setErrorMsg("Couldn't load your Zotero libraries.");
          setPhase("error");
          return;
        }
        const data = await res.json();
        const libs: Library[] = data.libraries ?? [];
        setLibraries(libs);
        if (libs.length === 1) {
          // Only the personal library: skip the picker.
          setLibrary(libs[0]);
          await loadCollections(libs[0]);
        } else {
          setPhase("chooseLibrary");
        }
      } catch {
        setErrorMsg("Network error loading libraries.");
        setPhase("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter((c) => c.name.toLowerCase().includes(q));
  }, [collections, filter]);

  function chooseLibrary(lib: Library) {
    setLibrary(lib);
    loadCollections(lib);
  }

  async function confirm() {
    if (!selectedKey || !library) return;
    setPhase("syncing");
    setErrorMsg(null);
    try {
      const selRes = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionKey: selectedKey,
          libraryType: library.type,
          libraryId: library.id,
        }),
      });
      if (!selRes.ok) throw new Error("select");

      const syncRes = await fetch("/api/sync", { method: "POST" });
      if (!syncRes.ok) throw new Error("sync");

      router.replace("/");
    } catch {
      setErrorMsg("Sync failed. Please try again.");
      setPhase("choose");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">
        {phase === "chooseLibrary" ? "Choose a library" : "Choose a collection"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {phase === "chooseLibrary"
          ? "Pick which Zotero library to play from — your personal library or a group library."
          : "Pick the Zotero collection you want to play from. Each day a random paper from it becomes your puzzle."}
      </p>

      {(phase === "loadingLibraries" || phase === "loadingCollections") && (
        <p className="mt-8 text-sm text-muted">
          {phase === "loadingLibraries"
            ? "Loading your libraries…"
            : "Loading collections…"}
        </p>
      )}

      {phase === "error" && (
        <div className="mt-8">
          <p className="text-sm text-danger">{errorMsg}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#0b1020]"
          >
            Retry
          </button>
        </div>
      )}

      {phase === "chooseLibrary" && (
        <ul className="mt-6 flex flex-col gap-1">
          {libraries.map((lib) => (
            <li key={`${lib.type}:${lib.id}`}>
              <button
                onClick={() => chooseLibrary(lib)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-left text-sm transition-colors hover:border-accent/50"
              >
                <span className="font-medium">{lib.name}</span>
                <span className="ml-2 text-xs text-muted">
                  {lib.type === "group" ? "Group library" : "Personal"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {(phase === "choose" || phase === "syncing") && (
        <>
          {libraries.length > 1 && library && (
            <button
              onClick={() => setPhase("chooseLibrary")}
              disabled={phase === "syncing"}
              className="mt-4 self-start text-xs text-accent underline disabled:opacity-40"
            >
              ← {library.name}
            </button>
          )}

          {collections.length === 0 ? (
            <p className="mt-8 text-sm text-muted">
              This library doesn&rsquo;t have any collections yet. Create one in
              Zotero, add some papers with PDFs, then refresh this page.
            </p>
          ) : (
            <>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter collections…"
                disabled={phase === "syncing"}
                className="mt-6 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <ul className="mt-3 flex max-h-[50vh] flex-col gap-1 overflow-auto">
                {filtered.map((c) => {
                  const active = c.key === selectedKey;
                  return (
                    <li key={c.key}>
                      <button
                        disabled={phase === "syncing"}
                        onClick={() => setSelectedKey(c.key)}
                        className={[
                          "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                          active
                            ? "border-accent bg-accent/10 text-foreground"
                            : "border-border bg-surface hover:border-accent/50",
                          c.parentCollection ? "ml-4" : "",
                        ].join(" ")}
                      >
                        {c.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {errorMsg && phase === "choose" && (
            <p className="mt-3 text-sm text-danger">{errorMsg}</p>
          )}

          <button
            onClick={confirm}
            disabled={!selectedKey || phase === "syncing"}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-[#0b1020] transition-opacity disabled:opacity-40"
          >
            {phase === "syncing"
              ? "Syncing your library…"
              : "Use this collection"}
          </button>
          {phase === "syncing" && (
            <p className="mt-2 text-xs text-muted">
              Importing papers from Zotero. This can take a moment for large
              collections.
            </p>
          )}
        </>
      )}
    </div>
  );
}
