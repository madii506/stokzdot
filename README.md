# stokz

The first in-game stock market. A terminal on Solana where real tokenized stocks, the perps, the pump.fun trenches and the city's own companies trade side by side on the big board.

- `/` home: one screen. The city at dusk, live in three.js (`assets/js/stokz3d.js`): towers rise when the page opens, windows twinkle, searchlights sweep, beacons blink. Real stock prices rise off the rooftops as tags and run along the tape. The NYSE clock is real. Nothing under it.
- `/app` the terminal. Key 0 is the big board (every listing, live, gainers and losers). Then overview, trade, stocks, IPO (list one of the city's 24 companies on pump.fun from your wallet), perps, the trenches, portfolio, docs.
- Every confirmed trade prints a receipt. stokz never holds funds; your wallet signs everything.
- `api/m.js` one Vercel function: prices, quotes, swaps, perps, trenches, the city registry.

Launch settings: `assets/js/config.js` (`window.STOKZ = { ca, x }`). Postgres via `DATABASE_URL`.
