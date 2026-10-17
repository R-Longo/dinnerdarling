# Illustration slots

The second kit is installed: header vine, 5 proteins, 6 meal types, and botanicals (lemon branch, basil, olive, herbs, garlic). Recipe cards reuse the meal-type and protein pictures (see `recipes` in `assets.json`). To swap any picture, replace the file or change its path.

Drop image files in this folder, then add their paths to `assets.json`.
Anything left blank (or missing) uses the built-in drawings, so you can fill these in one at a time.

- `header`: botanical artwork behind the top-right of the home screen. Transparent PNG/WebP, about 600 px wide.
- `protein.<name>`: protein icons (chicken, salmon, turkey, pork, steak). Transparent PNG/WebP, 256 px square.
- `mealType.<name>`: meal-type icons (bowls, pasta, soup, skillet, sheet-pan, salad). 256 px square.
- `glance.lemon`: the Flavor icon in At a Glance.
- `decor.<slot>`: botanicals for the empty Favorites screen (`favoritesEmpty`), an empty Shopping List (`shoppingEmpty`), no search results (`noResults`), and the end of the recipe list (`listEnd`). `weekRosemary` (Rosemary peeking over the top-right of the This Week calendar) always shows there, whatever is planned (`rosemary-girl.webp` is the older, larger version and is no longer used); `favoritesFooter` (garlic) closes out Favorites once it has items.
- `recipes.<recipe-id>`: small decorative art for one recipe, for example
  `"recipes": { "turkey-bolognese": "assets/recipes/turkey-bolognese.png" }`. 400 px square, transparent background.

A recipe can also set its own `"image"` field in `recipes.json`, which wins over `assets.json`.
After changing files, bump `VERSION` in `sw.js` so installed copies refresh.

## Mascot (not in use yet)
`assets/mascot/` holds Tilly Tomato, "Director of Dinner Operations": `tilly-cooking.webp` (carrying a mixing bowl) and `tilly-clipboard.webp` (holding her clipboard). They are not listed in `assets.json` or the service worker, so the app does not load them. To use one later, add a slot in `assets.json` and reference it through `DDArt`.
