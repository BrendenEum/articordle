import type { Metadata } from "next";
import Link from "next/link";
import DeleteAccount from "@/components/DeleteAccount";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Privacy · Articordle" };
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const session = await getSession();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← Back to Articordle
      </Link>

      <h1 className="mt-6 text-2xl font-bold tracking-tight">Privacy</h1>

      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
        <li>
          We store your Zotero user ID and username, your Zotero API key
          (encrypted), metadata for papers in your chosen collection, and your
          game history.
        </li>
        <li>
          To make clues, a paper&apos;s PDF text is sent to Google&apos;s Gemini
          API. We keep the clues, not the PDF.
        </li>
        <li>
          We use one cookie to keep you signed in. No ads or tracking.
        </li>
        <li>Articordle is not affiliated with Zotero.</li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Delete your data</h2>
      <p className="mt-2 text-sm text-muted">
        This permanently removes everything above. You can also revoke your key
        at{" "}
        <a
          href="https://www.zotero.org/settings/keys"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-accent"
        >
          zotero.org/settings/keys
        </a>
        .
      </p>
      <div className="mt-4">
        {session.userId ? (
          <DeleteAccount />
        ) : (
          <p className="text-sm text-muted">
            <Link href="/login" className="underline hover:text-accent">
              Sign in
            </Link>{" "}
            to delete your account.
          </p>
        )}
      </div>
    </div>
  );
}
