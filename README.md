# Singulax

Singulax is an English-friendly programming language using `.sglx` files. This distribution contains:

- `runtime/sglx.mjs`: dependency-free JavaScript runtime for browsers and Node.js
- `browser/`: offline-capable Singulax Studio IDE with code and block modes
- `bin/sglx.mjs`: terminal runner for Node.js
- `sglx.py`: legacy/reference Python runtime
- `examples/`: language examples

## Links

Github Pages: https://lyte3075.github.io/SingulaX/

Cloudflare Pages: https://singulax.pages.dev

## Browser / iPhone

Singulax Studio is browser-first. It does not require Python. Host the `browser/` directory with the adjacent `runtime/` directory on any static web server, open it in Safari/Chrome, and optionally add it to the home screen. After the first load, the service worker caches the app for offline use.

## Terminal

Node.js is the terminal runtime target:

`node bin/sglx.mjs examples/09_game_input.sglx`

This is separate from the browser app. A future native compiler can replace the Node runtime without changing `.sglx` source.

## Project files

Studio saves projects locally and exports/imports `.sglxproj` JSON project bundles. A project contains its `.sglx` source files and can be extended with assets and metadata.
