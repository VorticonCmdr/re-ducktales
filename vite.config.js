import { defineConfig, searchForWorkspaceRoot } from "vite";
import { readdir, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export default defineConfig(async () => {
  const allow = [
    searchForWorkspaceRoot(fileURLToPath(new URL(".", import.meta.url))),
  ];
  // Managed worktrees may link the authoritative originals instead of copying
  // them. Permit only that asset directory in addition to Vite's normal root.
  try {
    allow.push(await realpath(new URL("./game/", import.meta.url)));
  } catch {}
  return {
    server: { fs: { allow } },
    base: "./",
    build: {
      rollupOptions: { input: { index: "index.html", viewer: "viewer.html" } },
    },
    plugins: [
      {
        name: "local-game-manifest",
        configureServer(server) {
          server.middlewares.use("/__local_assets", async (_req, res) => {
            try {
              const entries = await readdir(
                new URL("./game/", import.meta.url),
                { withFileTypes: true },
              );
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify(
                  entries
                    .filter((e) => e.isFile() && !e.name.startsWith("."))
                    .map((e) => e.name)
                    .sort(),
                ),
              );
            } catch {
              res.statusCode = 404;
              res.end("Local game folder unavailable");
            }
          });
        },
      },
    ],
  };
});
