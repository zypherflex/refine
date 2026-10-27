import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// The driver page shares the phone's location, and its address holds the link's secret, so it is never sent on.
const driverHeaders = [
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cache-Control", value: "no-store" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs", "unpdf", "nodemailer", "@aws-sdk/client-s3"],
  experimental: { serverActions: { bodySizeLimit: "16mb" } },
  async headers() {
    // Later entries override earlier ones for the same header.
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/drive/:path*", headers: driverHeaders },
    ];
  },
};

export default nextConfig;
