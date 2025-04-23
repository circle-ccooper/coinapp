const { CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET } = process.env;

if (!CIRCLE_API_KEY?.trim()) {
  throw new Error("CIRCLE_API_KEY environment variable is missing or empty");
}

if (!CIRCLE_ENTITY_SECRET?.trim()) {
  throw new Error("CIRCLE_ENTITY_SECRET environment variable is missing or empty");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdf-parse"],

  // Add allowedDevOrigins for your Replit URL - using exact format from documentation
  allowedDevOrigins: [
    '64b3466d-48ab-43ac-94e1-df5a0c65600c-00-3dcvk8y4qe4v6.kirk.replit.dev'
  ]
};

module.exports = nextConfig;