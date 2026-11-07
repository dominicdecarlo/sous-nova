/** @type {import('next').NextConfig} */
const config = {
  cleanDistDir: false,
  experimental: { cpus: 1 },
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
};
export default config;
