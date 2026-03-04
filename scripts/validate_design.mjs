import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendScript = path.resolve(__dirname, "..", "backend", "scripts", "validate_design.mjs");

const child = spawn("node", [backendScript], {
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
