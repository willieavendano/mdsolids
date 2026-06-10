import type { ModuleDef } from "../../core/types";
import { el } from "../../core/dom";

// STUB — to be implemented by a Hermes build agent per MODULE_CONTRACT.md.
const module: ModuleDef = {
  id: "beam",
  title: "Beam Diagrams",
  category: "Beams",
  description: "Reactions plus shear-force and bending-moment diagrams for loaded beams.",
  icon: "📏",
  mount(root) {
    root.append(el("p", { class: "note" }, "Module under construction."));
  },
};

export default module;
