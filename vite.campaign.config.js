import base from "./vite.config.js";

// Long recorded campaigns must not be reset by development-server reloads or
// another checkout's shared dependency cache. Game/runtime behavior is unchanged.
export default async function campaignServer(environment) {
  const config = await base(environment);
  return {
    ...config,
    cacheDir: ".local/campaign-vite-cache",
    server: { ...config.server, hmr: false, watch: null },
  };
}
