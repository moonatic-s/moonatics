// GitHub Pages serves 404.html for unknown paths. The app is a single page, so reuse index.html: a mistyped
// link then still opens the game instead of an error page.
import { copyFileSync } from "node:fs";

copyFileSync("dist/index.html", "dist/404.html");
console.log("dist/404.html written");
