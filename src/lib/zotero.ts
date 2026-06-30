import crypto from "crypto";
import OAuth from "oauth-1.0a";
import { env } from "./env";

/**
 * Zotero integration: OAuth 1.0a handshake to obtain a per-user API key, plus
 * thin wrappers over the Zotero Web API v3.
 *
 * OAuth endpoints: https://www.zotero.org/support/dev/web_api/v3/oauth
 */

const REQUEST_TOKEN_URL = "https://www.zotero.org/oauth/request";
const AUTHORIZE_URL = "https://www.zotero.org/oauth/authorize";
const ACCESS_TOKEN_URL = "https://www.zotero.org/oauth/access";
const API_BASE = "https://api.zotero.org";

function oauthClient() {
  return new OAuth({
    consumer: { key: env.zoteroClientKey, secret: env.zoteroClientSecret },
    signature_method: "HMAC-SHA1",
    hash_function(baseString, key) {
      return crypto.createHmac("sha1", key).update(baseString).digest("base64");
    },
  });
}

export interface RequestToken {
  token: string;
  tokenSecret: string;
}

/** Step 1: obtain a temporary request token and the URL to send the user to. */
export async function getRequestToken(callbackUrl: string): Promise<RequestToken> {
  const oauth = oauthClient();
  const data = { oauth_callback: callbackUrl };
  const headers = oauth.toHeader(
    oauth.authorize({ url: REQUEST_TOKEN_URL, method: "POST", data }),
  );
  const res = await fetch(REQUEST_TOKEN_URL, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(data).toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Zotero request token failed (${res.status}): ${text}`);
  }
  const params = new URLSearchParams(text);
  const token = params.get("oauth_token");
  const tokenSecret = params.get("oauth_token_secret");
  if (!token || !tokenSecret) {
    throw new Error(`Zotero request token response malformed: ${text}`);
  }
  return { token, tokenSecret };
}

export function getAuthorizeUrl(token: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("oauth_token", token);
  return url.toString();
}

export interface ZoteroAccess {
  apiKey: string;
  userId: string;
  username: string | null;
}

/** Step 3: exchange the authorized request token for the permanent API key. */
export async function getAccessToken(
  oauthToken: string,
  oauthTokenSecret: string,
  verifier: string,
): Promise<ZoteroAccess> {
  const oauth = oauthClient();
  const data = { oauth_verifier: verifier };
  const headers = oauth.toHeader(
    oauth.authorize(
      { url: ACCESS_TOKEN_URL, method: "POST", data },
      { key: oauthToken, secret: oauthTokenSecret },
    ),
  );
  const res = await fetch(ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(data).toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Zotero access token failed (${res.status}): ${text}`);
  }
  const params = new URLSearchParams(text);
  // For Zotero, the returned oauth_token IS the usable API key.
  const apiKey = params.get("oauth_token");
  const userId = params.get("userID");
  if (!apiKey || !userId) {
    throw new Error(`Zotero access token response malformed: ${text}`);
  }
  return { apiKey, userId, username: params.get("username") };
}

/**
 * Validate a personal Zotero API key and return the user it belongs to.
 * Lets a player sign in by pasting a read-only key instead of running the
 * full OAuth flow. Endpoint: https://api.zotero.org/keys/current
 */
export async function verifyApiKey(apiKey: string): Promise<ZoteroAccess> {
  const res = await fetch(`${API_BASE}/keys/current`, {
    headers: {
      "Zotero-API-Version": "3",
      "Zotero-API-Key": apiKey,
    },
  });
  if (!res.ok) {
    throw new Error(`Zotero key verification failed (${res.status})`);
  }
  const data = (await res.json()) as { userID?: number; username?: string };
  if (!data.userID) {
    throw new Error("Zotero key response missing userID");
  }
  return {
    apiKey,
    userId: String(data.userID),
    username: data.username ?? null,
  };
}

// --- Web API helpers ---------------------------------------------------------

/**
 * A Zotero library to read from: the user's personal library ("user") or a
 * group library ("group"). `id` is the numeric user id or group id.
 */
export interface ZoteroLibrary {
  type: "user" | "group";
  id: string;
}

/** API path prefix for a library, e.g. "/users/123" or "/groups/456". */
function libraryPath(lib: ZoteroLibrary): string {
  return lib.type === "group" ? `/groups/${lib.id}` : `/users/${lib.id}`;
}

async function zoteroFetch(
  apiKey: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Zotero-API-Version": "3",
      "Zotero-API-Key": apiKey,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Zotero API ${path} failed (${res.status}): ${body}`);
  }
  return res;
}

/** Fetch all pages of a Zotero list endpoint. */
async function zoteroFetchAll<T>(apiKey: string, path: string): Promise<T[]> {
  const limit = 100;
  let start = 0;
  const all: T[] = [];
  // Loop until a page returns fewer than `limit` results.
  for (;;) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await zoteroFetch(
      apiKey,
      `${path}${sep}limit=${limit}&start=${start}`,
    );
    const page = (await res.json()) as T[];
    all.push(...page);
    if (page.length < limit) break;
    start += limit;
  }
  return all;
}

export interface ZoteroCollection {
  key: string;
  name: string;
  parentCollection: string | false;
}

export async function listCollections(
  apiKey: string,
  library: ZoteroLibrary,
): Promise<ZoteroCollection[]> {
  type Raw = {
    key: string;
    data: { name: string; parentCollection: string | false };
  };
  const raw = await zoteroFetchAll<Raw>(
    apiKey,
    `${libraryPath(library)}/collections`,
  );
  return raw.map((c) => ({
    key: c.key,
    name: c.data.name,
    parentCollection: c.data.parentCollection,
  }));
}

export interface ZoteroGroup {
  id: string;
  name: string;
}

/** List the group libraries the user can access. */
export async function listGroups(
  apiKey: string,
  userId: string,
): Promise<ZoteroGroup[]> {
  type Raw = { id: number; data: { name: string } };
  const raw = await zoteroFetchAll<Raw>(apiKey, `/users/${userId}/groups`);
  return raw.map((g) => ({ id: String(g.id), name: g.data.name }));
}

export interface ZoteroCreator {
  creatorType: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

export interface ZoteroItem {
  key: string;
  itemType: string;
  title: string;
  creators: ZoteroCreator[];
  date: string;
  publicationTitle: string;
  abstractNote: string;
}

export async function listCollectionItems(
  apiKey: string,
  library: ZoteroLibrary,
  collectionKey: string,
): Promise<ZoteroItem[]> {
  type Raw = {
    key: string;
    data: {
      itemType: string;
      title?: string;
      creators?: ZoteroCreator[];
      date?: string;
      publicationTitle?: string;
      abstractNote?: string;
    };
  };
  const raw = await zoteroFetchAll<Raw>(
    apiKey,
    `${libraryPath(library)}/collections/${collectionKey}/items/top`,
  );
  return raw
    .filter((i) => i.data.itemType !== "attachment" && i.data.itemType !== "note")
    .map((i) => ({
      key: i.key,
      itemType: i.data.itemType,
      title: i.data.title ?? "",
      creators: i.data.creators ?? [],
      date: i.data.date ?? "",
      publicationTitle: i.data.publicationTitle ?? "",
      abstractNote: i.data.abstractNote ?? "",
    }));
}

interface ZoteroAttachment {
  key: string;
  contentType: string;
  filename: string;
}

/** Return the first PDF attachment for an item, if any. */
export async function findPdfAttachment(
  apiKey: string,
  library: ZoteroLibrary,
  itemKey: string,
): Promise<ZoteroAttachment | null> {
  type Raw = {
    key: string;
    data: { itemType: string; contentType?: string; filename?: string };
  };
  const res = await zoteroFetch(
    apiKey,
    `${libraryPath(library)}/items/${itemKey}/children?itemType=attachment`,
  );
  const children = (await res.json()) as Raw[];
  const pdf = children.find(
    (c) => c.data.contentType === "application/pdf",
  );
  if (!pdf) return null;
  return {
    key: pdf.key,
    contentType: pdf.data.contentType ?? "application/pdf",
    filename: pdf.data.filename ?? "paper.pdf",
  };
}

/** Download the raw bytes of an attachment's stored file. */
export async function downloadAttachment(
  apiKey: string,
  library: ZoteroLibrary,
  attachmentKey: string,
): Promise<Buffer> {
  const res = await zoteroFetch(
    apiKey,
    `${libraryPath(library)}/items/${attachmentKey}/file`,
  );
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
