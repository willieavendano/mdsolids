import { allModules, moduleById } from "./registry";
import { CATEGORIES } from "./types";
import { el, clear } from "./dom";

/**
 * The application shell: sidebar navigation + content area, driven by the URL
 * hash (`#/<module-id>`). Hash routing keeps the app a fully static site that
 * works on GitHub Pages with no server-side rewrites.
 */
export function startApp(root: HTMLElement): void {
  const content = el("main", { class: "content", id: "content" });
  const sidebar = buildSidebar();
  root.append(
    el("div", { class: "layout" }, sidebar, content),
  );

  let cleanup: (() => void) | void;

  const renderRoute = () => {
    if (typeof cleanup === "function") cleanup();
    cleanup = undefined;
    clear(content);

    const id = location.hash.replace(/^#\/?/, "");
    const mod = id ? moduleById(id) : undefined;

    // Highlight active nav item.
    sidebar.querySelectorAll(".nav-item").forEach((n) =>
      n.classList.toggle("active", (n as HTMLElement).dataset.id === id),
    );

    if (!mod) {
      renderHome(content);
      return;
    }
    content.append(
      el(
        "header",
        { class: "module-header" },
        el("span", { class: "module-icon" }, mod.icon),
        el(
          "div",
          {},
          el("h2", {}, mod.title),
          el("p", { class: "module-sub" }, mod.description),
        ),
      ),
    );
    const mountPoint = el("div", { class: "module-body" });
    content.append(mountPoint);
    cleanup = mod.mount(mountPoint);
  };

  window.addEventListener("hashchange", renderRoute);
  renderRoute();
}

function buildSidebar(): HTMLElement {
  const nav = el("nav", { class: "sidebar" });
  nav.append(
    el(
      "a",
      { class: "brand", href: "#/" },
      el("span", { class: "brand-mark" }, "△"),
      el("span", {}, "MDSolids ", el("span", { class: "brand-web" }, "Web")),
    ),
  );

  const mods = allModules();
  for (const cat of CATEGORIES) {
    const inCat = mods.filter((m) => m.category === cat);
    if (inCat.length === 0) continue;
    nav.append(el("div", { class: "nav-cat" }, cat));
    for (const m of inCat) {
      nav.append(
        el(
          "a",
          { class: "nav-item", href: `#/${m.id}`, "data-id": m.id },
          el("span", { class: "nav-icon" }, m.icon),
          m.title,
        ),
      );
    }
  }

  nav.append(
    el(
      "a",
      {
        class: "nav-foot",
        href: "https://github.com/willieavendano/mdsolids",
        target: "_blank",
        rel: "noopener",
      },
      "Open source on GitHub ↗",
    ),
  );
  return nav;
}

function renderHome(content: HTMLElement): void {
  content.append(
    el(
      "header",
      { class: "module-header" },
      el("span", { class: "module-icon" }, "△"),
      el(
        "div",
        {},
        el("h2", {}, "Mechanics of Materials, in your browser"),
        el(
          "p",
          { class: "module-sub" },
          "A free, open-source, cross-platform reimagining of MDSolids. Pick a module to begin.",
        ),
      ),
    ),
  );
  const grid = el("div", { class: "home-grid" });
  for (const m of allModules()) {
    grid.append(
      el(
        "a",
        { class: "home-card", href: `#/${m.id}` },
        el("span", { class: "home-card-icon" }, m.icon),
        el("h3", {}, m.title),
        el("p", {}, m.description),
        el("span", { class: "home-card-cat" }, m.category),
      ),
    );
  }
  content.append(grid);
}
