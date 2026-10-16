# Dinner Darling v0.1

Dinner, decided. A mobile-first PWA: recipe box, favorites, and a three-dinner This Week plan.

## Deploy to Netlify
- **Drag and drop:** zip or drag this whole folder onto https://app.netlify.com/drop
- **Git:** push the folder to a repo, then Add new site > Import. No build command; publish directory is `.`

## Install on a phone
Open the Netlify URL, then Share > Add to Home Screen (iOS Safari) or Install app (Android Chrome).

## Run locally
    python3 -m http.server 8000     # then open http://localhost:8000

## Adding or editing recipes
Edit `recipes.json` only. Filters, chips, and cards build themselves from it.
Each ingredient has a numeric `quantity`, a `unit`, and an `aisle`, ready for grocery-list generation later.
Rebecca Notes live in the `rebeccaNotes` field.

## Shipping changes to phones
Recipe edits show up on next load. If you change `app.js`, `styles.css`, or `index.html`,
bump `VERSION` in `sw.js` so installed copies refresh.

## Where your data lives
Favorites and This Week are stored in each device's browser (localStorage). No accounts, no sync.
This Week clears itself when a new week (Monday) starts.
