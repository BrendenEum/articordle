import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse / pdfjs don't bundle correctly under Turbopack; load them as a
  // native Node dependency at runtime instead.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
