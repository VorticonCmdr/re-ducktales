# DuckTales: The Quest for Gold — web port workspace

An HTML / vanilla JavaScript port starting with an original-resource explorer.
The game itself is not yet implemented.

## Run locally

Requires Node.js 22.12+ (or Node.js 20.19+) and npm.

```sh
npm install
npm run dev
```

Open the server's displayed URL and select `viewer.html` (the root redirects there).
The development server discovers original files in `game/` automatically. You can
also select a folder or individual files in the viewer. Selected files are read
in the browser, without uploading them.

The viewer supports archive/type filtering, searching decoded text, pictures,
sprite animation and frame selection, optional transparency, the original font,
PC-speaker sound auditions, hex inspection, and PNG / WAV / decoded-byte exports.

## Original files and Git

`game/` is excluded from Git, as are `node_modules/` and `dist/`. Supply your own
original DOS files there. No original resource data is copied into source code or
production builds. Asset exports should be saved outside the tracked project.
A `.gitignore` was not present when this workspace was initialized; one was
created without replacing any existing file.

## Verify and build

```sh
npm test
npm run audit:assets
npm run build
npm run preview
```

The audit requires local originals and decodes every resource, renders every
image frame, and exercises all 121 PC-speaker sound IDs. Unit tests use synthetic
data and run without the game files.

`dist/` is a static site with relative asset URLs, suitable for a future GitHub
Pages project deployment. The production viewer asks visitors to select their
own files; the local development manifest is not deployed. No remote repository
or Pages deployment is configured yet.

## Format documentation

- [Asset inventory and archive / graphics formats](docs/assets.md)
- [Sound sequence format and fidelity limits](docs/audio.md)
- [Verification and remaining reverse engineering](docs/verification.md)

The reusable decoders live in `src/assets.js`; sound rendering in `src/audio.js`.
These modules have no DOM dependency and can be reused by the game port.
