"use client";

import { useState } from "react";

export default function DeleteAccount() {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(false);

  async function deleteAccount() {
    if (!confirm("Permanently delete your account and all your data?")) return;
    setDeleting(true);
    setError(false);
    const res = await fetch("/api/auth/delete", { method: "POST" }).catch(
      () => null,
    );
    if (res?.ok) {
      window.location.href = "/login";
    } else {
      setError(true);
      setDeleting(false);
    }
  }

  return (
    <div>
      <button
        onClick={deleteAccount}
        disabled={deleting}
        className="rounded-lg border border-danger/40 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
      >
        {deleting ? "Deleting…" : "Delete my account"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-danger">
          Couldn&apos;t delete your account. Please try again.
        </p>
      )}
    </div>
  );
}
