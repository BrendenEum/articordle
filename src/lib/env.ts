/**
 * Centralized, validated access to environment variables. Throws early with a
 * clear message if a required variable is missing so misconfiguration surfaces
 * at startup rather than deep inside a request.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get zoteroClientKey() {
    return required("ZOTERO_CLIENT_KEY");
  },
  get zoteroClientSecret() {
    return required("ZOTERO_CLIENT_SECRET");
  },
  get geminiApiKey() {
    return required("GEMINI_API_KEY");
  },
  get geminiModel() {
    return optional("GEMINI_MODEL", "gemini-3.1-flash-lite");
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get encryptionKey() {
    return required("ENCRYPTION_KEY");
  },
  get appBaseUrl() {
    // On Heroku, prefer the canonical URL if set; otherwise fall back.
    return optional("APP_BASE_URL", "http://localhost:3000").replace(/\/$/, "");
  },
};
