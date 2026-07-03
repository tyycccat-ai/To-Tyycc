const isCloudflareStaticExport =
  process.env.CLOUDFLARE_PAGES === "1" || process.env.CF_PAGES_STATIC === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(isCloudflareStaticExport
    ? {
        output: "export"
      }
    : {})
};

export default nextConfig;
