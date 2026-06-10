/**
 * Tiny DOM helpers — a framework-free toolkit shared by all modules.
 * Keeping this minimal makes modules trivial to write and review.
 */

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;
type Child = Node | string | null | undefined | false;

/** Create an element with attributes/handlers and children. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === "class") node.className = String(v);
    else if (k === "html") node.innerHTML = String(v);
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (typeof v === "boolean") {
      if (v) node.setAttribute(k, "");
    } else {
      node.setAttribute(k, String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Clear an element's children. */
export function clear(node: HTMLElement): void {
  node.replaceChildren();
}

/** Append children to a node, skipping null/undefined/false (unlike raw .append). */
export function append(node: HTMLElement, ...children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export interface NumberFieldOpts {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  onInput: (value: number) => void;
}

/** A labelled numeric input with an optional unit suffix. Returns the wrapper. */
export function numberField(opts: NumberFieldOpts): HTMLLabelElement {
  const input = el("input", {
    type: "number",
    value: String(opts.value),
    step: opts.step ?? "any",
    min: opts.min,
    max: opts.max,
    class: "field-input",
    onInput: (e) => {
      const raw = (e.target as HTMLInputElement).value;
      const n = parseFloat(raw);
      if (!Number.isNaN(n)) opts.onInput(n);
    },
  });
  return el(
    "label",
    { class: "field" },
    el("span", { class: "field-label" }, opts.label),
    el(
      "span",
      { class: "field-row" },
      input,
      opts.unit ? el("span", { class: "field-unit" }, opts.unit) : null,
    ),
  );
}

export interface SelectFieldOpts {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export function selectField(opts: SelectFieldOpts): HTMLLabelElement {
  const select = el("select", {
    class: "field-input",
    onChange: (e) => opts.onChange((e.target as HTMLSelectElement).value),
  });
  for (const o of opts.options) {
    const option = el("option", { value: o.value }, o.label);
    if (o.value === opts.value) option.selected = true;
    select.append(option);
  }
  return el(
    "label",
    { class: "field" },
    el("span", { class: "field-label" }, opts.label),
    select,
  );
}

/** A titled panel. */
export function card(title: string, ...children: Child[]): HTMLElement {
  return el(
    "section",
    { class: "card" },
    el("h3", { class: "card-title" }, title),
    ...children,
  );
}

/** A read-only labelled result value. */
export function result(label: string, value: string, unit = ""): HTMLElement {
  return el(
    "div",
    { class: "result" },
    el("span", { class: "result-label" }, label),
    el("span", { class: "result-value" }, unit ? `${value} ${unit}` : value),
  );
}

/** Format a number with sensible significant figures for engineering output. */
export function fmt(n: number, sig = 4): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e5 || abs < 1e-3) return n.toExponential(sig - 1);
  return Number(n.toPrecision(sig)).toString();
}
