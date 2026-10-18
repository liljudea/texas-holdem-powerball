# Changelog — Texas Hold’em Powerball

This file records the finishing touches applied to the playable practice-table demo in this repository.

## v1.0.0 — Playable practice table (2026-10-18)

What I completed in this commit:

- Verified the UI and game code are wired together: index.html, style.css, and game.js are consistent and work together in the browser.
- Ensured controls for Deal / Check(Call) / Bet(Raise) / Fold are functional and map to the client-side poker engine.
- Implemented full hand evaluation (including straights, flushes, full houses, quads), side-pot handling, blinds, and multi-round betting flow.
- Added round log and turn indicator UI hooks for better visibility.
- Exposed simple server hooks on `window.pokerServerHooks` for future backend integration.
- Updated README with runnable / publish instructions and a clear list of included features.

How to run locally:

1. Clone or download this repo.
2. Open `index.html` in a modern browser (Chrome, Firefox, Edge, Safari).
3. Use the TABLE SETTINGS panel to set seat count, AI difficulty, and starting chips.
4. Click "Deal New Hand" to begin. Use the bet slider to choose raises and click the action buttons to play.

Notes & important limits:
- This is a browser-only practice demo. Do NOT use this code for real-money gambling.
- For production multiplayer, shuffle and deal on a trusted server and validate every action server-side.

Suggested next steps (if you want me to continue):
- Add small reveal animations for dealing card motion.
- Persist player settings (localStorage) so bankroll and preferences survive reloads.
- Add unit tests for hand evaluation to guard against edge cases like wheel straights and ties.

