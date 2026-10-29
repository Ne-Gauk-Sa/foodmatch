# FoodMatch (multi-device)

Files: `server.js` (Node + WebSocket server, keeps groups in data.json), `index.html` (the phone app, no build step), `logic.js` (threshold rules, shared by server and app), tests: `test.js`, `multiclient-test.js`, `browser-test.js`.

Run locally: `npm install && npm start`, then open http://localhost:8787

## Make it public with no account (from a normal home/office network)
1. Install Node 18+ and cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).
2. `npm install && npm start`
3. In a second terminal: `cloudflared tunnel --url http://localhost:8787`
4. Share the printed https://….trycloudflare.com address. It changes every time and only works while both commands run.

## Always-on hosting (needs a free account)
Render.com free "Web Service": push this folder to a GitHub repo, New > Web Service, Build `npm install`, Start `npm start`. WebSockets work. Free instances sleep after ~15 min idle (first open takes ~1 min) and data.json resets on redeploy.

### Render blueprint
`render.yaml` is included: on Render choose New > Blueprint, pick this repo, and it creates a free Node web service (`npm install`, `npm start`, health check `/health`). The server listens on `process.env.PORT` and `0.0.0.0`. Invite links are built from the address the app was opened on, so they use the Render URL automatically.

Tests: `npm test` (logic + 3 WebSocket clients against a running server), `npm run test:browser` (3 headless Chrome phones; needs Chrome at /usr/bin/google-chrome).
