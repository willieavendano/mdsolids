import { allModules, moduleById } from "./registry";
import { CATEGORIES, type ModuleDef } from "./types";
import { el, clear, selectField } from "./dom";
import { buildHash, makeSaveFile, parseHash, parseSaveFile } from "./state";
import { setUnitSystem, unitSystem, UNIT_SYSTEMS, type UnitSystemId } from "./units";

/**
 * The application shell: sidebar navigation + content area, driven by the URL
 * hash (`#/<module-id>[?s=<state>]`). Hash routing keeps the app a fully
 * static site that works on GitHub Pages/Vercel with no server-side rewrites.
 *
 * The shell also owns the module toolbar (examples, unit system, share link,
 * save/open, print) built on the ModuleContext state API: modules report
 * their serializable state on every redraw and the shell mirrors it into the
 * URL (debounced, via replaceState so history stays clean).
 */
export function startApp(root: HTMLElement): void {
  const content = el("main", { class: "content", id: "content" });
  const sidebar = buildSidebar();
  const layout = el("div", { class: "layout" }, sidebar, content);
  root.append(
    el("a", { class: "skip-link", href: "#content" }, "Skip to content"),
    buildTopbar(layout),
    layout,
  );

  // Close the mobile drawer when a nav link is chosen.
  sidebar.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("a")) layout.classList.remove("nav-open");
  });

  let cleanup: (() => void) | void;
  let lastState: unknown;
  let urlTimer: number | undefined;

  const renderRoute = () => {
    if (typeof cleanup === "function") cleanup();
    cleanup = undefined;
    if (urlTimer !== undefined) clearTimeout(urlTimer);
    lastState = undefined;
    clear(content);

    const { id, state } = parseHash(location.hash);
    const mod = id ? moduleById(id) : undefined;

    // Highlight active nav item.
    sidebar.querySelectorAll(".nav-item").forEach((n) => {
      const active = (n as HTMLElement).dataset.id === id;
      n.classList.toggle("active", active);
      if (active) n.setAttribute("aria-current", "page");
      else n.removeAttribute("aria-current");
    });

    if (!mod) {
      renderHome(content);
      return;
    }

    content.append(
      el(
        "header",
        { class: "module-header" },
        el("span", { class: "module-icon", "aria-hidden": "true" }, mod.icon),
        el(
          "div",
          { class: "module-title" },
          el("h2", {}, mod.title),
          el("p", { class: "module-sub" }, mod.description),
        ),
        buildToolbar(mod, () => lastState, renderRoute),
      ),
    );

    const mountPoint = el("div", { class: "module-body" });
    content.append(mountPoint);
    cleanup = mod.mount(mountPoint, {
      initialState: state,
      reportState: (s) => {
        lastState = s;
        if (urlTimer !== undefined) clearTimeout(urlTimer);
        urlTimer = window.setTimeout(() => {
          history.replaceState(null, "", buildHash(mod.id, s));
        }, 250);
      },
    });
  };

  window.addEventListener("hashchange", renderRoute);
  renderRoute();
}

/** Examples / units / share / save / open / print controls for a module. */
function buildToolbar(
  mod: ModuleDef,
  getState: () => unknown,
  remount: () => void,
): HTMLElement {
  const bar = el("div", { class: "toolbar", role: "toolbar", "aria-label": "Module tools" });

  if (mod.examples && mod.examples.length > 0) {
    bar.append(
      selectField({
        label: "Examples",
        value: "",
        options: [
          { value: "", label: "Load example…" },
          ...mod.examples.map((ex, i) => ({ value: String(i), label: ex.title })),
        ],
        onChange: (v) => {
          const ex = mod.examples?.[Number(v)];
          if (ex) location.hash = buildHash(mod.id, ex.state);
        },
      }),
    );
  }

  bar.append(
    selectField({
      label: "Units",
      value: unitSystem(),
      options: UNIT_SYSTEMS.map((s) => ({ value: s.id, label: s.label })),
      onChange: (v) => {
        setUnitSystem(v as UnitSystemId);
        // Re-mount so unit labels refresh; state survives via the URL, which
        // reportState keeps current. Values are labels-only, never converted.
        remount();
      },
    }),
  );

  const copyBtn = el(
    "button",
    {
      class: "btn secondary",
      onClick: async () => {
        // Flush any pending state into the URL before copying.
        const s = getState();
        if (s !== undefined) history.replaceState(null, "", buildHash(mod.id, s));
        try {
          await navigator.clipboard.writeText(location.href);
          copyBtn.textContent = "Copied ✓";
        } catch {
          copyBtn.textContent = "Copy failed";
        }
        setTimeout(() => (copyBtn.textContent = "Copy link"), 1500);
      },
    },
    "Copy link",
  );

  const saveBtn = el(
    "button",
    {
      class: "btn secondary",
      onClick: () => {
        const file = makeSaveFile(mod.id, getState() ?? null);
        const blob = new Blob([JSON.stringify(file, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = el("a", { href: url, download: `mdsolids-${mod.id}.json` });
        a.click();
        URL.revokeObjectURL(url);
      },
    },
    "Save",
  );

  const fileInput = el("input", {
    type: "file",
    accept: ".json,application/json",
    style: "display:none",
    onChange: async (e) => {
      const input = e.target as HTMLInputElement;
      const f = input.files?.[0];
      input.value = "";
      if (!f) return;
      const saved = parseSaveFile(await f.text());
      if (!saved || !moduleById(saved.module)) {
        alert("Not a valid MDSolids Web save file.");
        return;
      }
      const target = buildHash(saved.module, saved.state);
      if (location.hash === target) remount();
      else location.hash = target;
    },
  });

  bar.append(
    copyBtn,
    saveBtn,
    el("button", { class: "btn secondary", onClick: () => fileInput.click() }, "Open"),
    el("button", { class: "btn secondary", onClick: () => window.print() }, "Print"),
    fileInput,
  );
  return bar;
}

/** Mobile-only topbar with a hamburger that toggles the sidebar drawer. */
function buildTopbar(layout: HTMLElement): HTMLElement {
  return el(
    "div",
    { class: "topbar" },
    el(
      "button",
      {
        class: "hamburger",
        "aria-label": "Toggle navigation",
        onClick: () => layout.classList.toggle("nav-open"),
      },
      "☰",
    ),
    el(
      "a",
      { class: "brand", href: "#/" },
      el("span", { class: "brand-mark" }, "△"),
      el("span", {}, "MDSolids ", el("span", { class: "brand-web" }, "Web")),
    ),
  );
}

function buildSidebar(): HTMLElement {
  const nav = el("nav", { class: "sidebar", "aria-label": "Modules" });
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
          el("span", { class: "nav-icon", "aria-hidden": "true" }, m.icon),
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
      el("span", { class: "module-icon", "aria-hidden": "true" }, "△"),
      el(
        "div",
        { class: "module-title" },
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
        el("span", { class: "home-card-icon", "aria-hidden": "true" }, m.icon),
        el("h3", {}, m.title),
        el("p", {}, m.description),
        el("span", { class: "home-card-cat" }, m.category),
      ),
    );
  }
  content.append(grid);
}
