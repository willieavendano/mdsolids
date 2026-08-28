import { register } from "../core/registry";

// Each module is registered here. Hermes-built modules get one import + one
// entry in the register() call below. Keep alphabetical within category.
import sectionProperties from "./section-properties";
import axial from "./axial";
import torsion from "./torsion";
import beam from "./beam";
import beamDeflection from "./beam-deflection";
import truss from "./truss";
import column from "./column";
import combinedLoading from "./combined-loading";
import stressTransform from "./stress-transform";
import strainTransform from "./strain-transform";
import pressureVessel from "./pressure-vessel";

export function registerAllModules(): void {
  register(
    sectionProperties,
    axial,
    torsion,
    beam,
    beamDeflection,
    truss,
    column,
    stressTransform,
    strainTransform,
    combinedLoading,
    pressureVessel,
  );
}
