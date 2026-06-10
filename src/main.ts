import "./styles/theme.css";
import { startApp } from "./core/shell";
import { registerAllModules } from "./modules";

registerAllModules();

const root = document.getElementById("app");
if (!root) throw new Error("#app root not found");
startApp(root);
