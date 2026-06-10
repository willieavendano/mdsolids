import { register } from "../core/registry";

// Each module is registered here. Hermes-built modules get one import + one
// entry in the register() call below. Keep alphabetical within category.
import sectionProperties from "./section-properties";
import axial from "./axial";
import torsion from "./torsion";
import beam from "./beam";
import truss from "./truss";
import column from "./column";
import stressTransform from "./stress-transform";
import pressureVessel from "./pressure-vessel";

export function registerAllModules(): void {
  register(
    sectionProperties,
    axial,
    torsion,
    beam,
    truss,
    column,
    stressTransform,
    pressureVessel,
  );
}
