import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep local capture panes free of the development status indicator while
  // preserving Next's compile/runtime error reporting.
  devIndicators: false,
};

export default nextConfig;
