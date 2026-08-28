import "./styles/theme.css";
import { startApp } from "./core/shell";
import { registerAllModules } from "./modules";

registerAllModules();

const root = document.getElementById("app");
if (!root) throw new Error("#app root not found");
startApp(root);

// Offline support (PWA). Dev builds skip it so the worker never serves stale
// modules against Vite's dev server.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .catch(() => {});
  });
}
