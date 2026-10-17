# Elfish Checkers · דמקת האלפים

A Tolkien-inspired race for two players. White elves and black elves try to reach each other's home oval, while two grumpy trolls stomp around bonking heads.

- Play two players on one device, or against the computer (Easy / Normal / Hard).
- Available in English and Hebrew (RTL). Use the globe button, or add `?lang=he` to the URL.
- Built with plain HTML, CSS and ES modules: no build step and no dependencies.

## Run locally

ES modules and the AI Web Worker need an HTTP server. Opening the file directly with `file://` won't work.

```sh
python3 -m http.server 5173
# open http://localhost:5173
```

Open `http://localhost:5173/tests.html` to run the rule tests.

## Deploy

The whole folder is a static site, so upload it as-is:

- **Netlify**: drag the folder onto app.netlify.com/drop.
- **Vercel**: run `vercel` in this folder (framework: *Other*, no build command).
- **GitHub Pages**: push to a repo, then go to Settings → Pages and deploy from the branch root.
- **Cloudflare Pages**: no build command; the output directory is `/`.

## Project layout

```
index.html            page shell, dialogs, settings
favicon.svg
tests.html            browser-based rule tests
src/
  main.js             game flow, HUD, undo, persistence, AI turns
  i18n.js             English + Hebrew strings
  game/board.js       board graph (2 ovals + 4-3-4-3-4 circles)
  game/rules.js       pure rules engine
  game/ai.js          negamax + alpha-beta AI
  game/ai-worker.js   runs the AI off the main thread
  ui/renderer.js      SVG board, layout and move animations
  ui/pieces.js        elf / troll artwork
  ui/fx.js            leaves, BONK!, dust, sparkles
  styles/             index.css (layout), board.css (SVG)
```
