# Texas Hold’em Powerball — Starter + Multiplayer Demo

Luxury black, gold, and red poker website starter with a playable multi-AI practice table.

## Run it locally
1. Download and unzip the project.
2. Open the folder.
3. Double-click `index.html` to open it in a browser.

No installation is required for the browser-only prototype.

## What is included
- 1 human player + 3 AI opponents
- Blind posting, betting rounds, check/call/fold, and raise flow
- Community cards on flop/turn/river
- Texas Hold’em hand ranking for showdown
- Pot and chip tracking
- UI updates across all table seats
- Browser-only architecture with server-ready hooks for future secure backend integration

## Server-ready hooks
This version exposes a lightweight API contract on `window.pokerServerHooks` for future backend migration.

Example contract:
- `startNewHand()` begins a new hand
- `getGameSnapshot()` returns the live state
- `executeAction(playerName, action, amount)` applies a player action
- `getVersion()` identifies the current API version

This keeps the client logic modular while leaving trust-sensitive logic, shuffling, and server-side validation to a future backend layer.

## Important limits
This is a practice table prototype, not a production online poker platform. It simulates gameplay in the browser and intentionally does not implement secure server-side card dealing, real bankroll validation, or authentication.

For a real multiplayer release:
- implement secure, private deck generation on a trusted server;
- validate every action server-side before mutating state;
- store player balances in a database with access controls;
- keep secrets off the browser and prevent tampering;
- add reconnect handling, timeout logic, and anti-collusion safeguards.

Virtual chips only. No deposits, cash prizes, or withdrawals.

## Publish with GitHub Pages
1. Create a GitHub repository named `texas-holdem-powerball`.
2. Upload `index.html`, `style.css`, `game.js`, and `README.md` to the repository root.
3. Open the repository's Settings tab.
4. Select Pages from the left menu.
5. Choose Deploy from a branch.
6. Select the default branch and folder `/(root)`.
7. Save and wait for the site to publish.

If Pages is unavailable, use a static host such as Netlify or Cloudflare Pages.
