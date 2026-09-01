const config = {
  // Next 16 drops editor-agent instruction files into the project root on
  // `next dev`. This repo keeps its own docs, so the generator stays off.
  agentRules: false,

  // Progress photos are served from Supabase Storage; nothing else is remote.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/**" }],
  },
};

export default config;
