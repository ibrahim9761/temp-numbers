# TempLine

A full temporary-number tool: browse open lines from your API, select one, and
watch its SMS inbox update live. Dark, custom "signal strip" design, fully
mobile responsive, zero build step.

## Run it

```bash
npm install
npm start
```

Open http://localhost:3000

## Deploy it

Works on any Node host (Render, Railway, Fly.io, a VPS, etc.):

1. Push this folder to a repo (or upload it directly).
2. Set the start command to `npm start` (or `node server.js`).
3. No environment variables or API keys are needed — the API you gave me
   (`apis.davidcyriltech.my.id`) doesn't require auth.

## One thing to verify

I couldn't reach `apis.davidcyriltech.my.id` from the environment I built
this in (it's not on my sandbox's network allowlist), so I couldn't inspect
a real response and confirm the exact field names.

The backend (`server.js`) normalizes the upstream JSON defensively — it
already tries the most common shapes these free APIs use (`numbers`/`data`/
`result`/`results` arrays, `number`/`phone`/`msisdn` fields, `message`/`text`/
`body` fields, etc.), so there's a good chance it works out of the box.

If, once deployed, the number list or inbox comes up empty even though the
API is clearly returning data:

1. Visit `/api/numbers` and `/api/inbox?number=+1...` directly in your
   browser to see the raw normalized output your server produced.
2. If it looks empty, temporarily add `console.log(json)` right after the
   `fetchJson(...)` calls in `server.js` to print the *actual* upstream
   shape to your server logs.
3. Add whichever field name it's using to the relevant line in
   `normalizeNumbers()` or `normalizeInbox()` at the top of `server.js` —
   those two functions are the only place that needs adjusting.

## What's included

- `server.js` — Express backend. Proxies both endpoints server-side (so the
  browser never CORS-fails and your traffic pattern isn't exposed client-side),
  with a 12s timeout and normalized error responses.
- `public/index.html` / `styles.css` / `app.js` — the frontend. No framework,
  no build step, just open `index.html`-shaped output straight from Express.
- Live inbox polling every 6 seconds while a number is selected, with a
  pulsing "LIVE" signal-strip indicator.
- Copy-to-clipboard on the active number.
- Loading, empty, and error states for both the line list and the inbox.
- Fully responsive down to small phones (nav collapses, panels stack).

## Notes on the product itself

The FAQ section is upfront that these are **shared, public numbers** — not
private. That's accurate for this category of free SMS-receiving API, and
worth keeping honest in the copy so users don't misuse it for anything
sensitive (e.g. account recovery).
