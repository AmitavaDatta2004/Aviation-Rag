import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['vectra', 'pdfjs-dist', '@xenova/transformers'],
};

export default nextConfig;
