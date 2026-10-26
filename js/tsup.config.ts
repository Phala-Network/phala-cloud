import { defineConfig } from "tsup";

// These ESM dependencies are bundled so the SDK's CJS entry still loads on Node 18.
export default defineConfig({ noExternal: ["p-retry", "delay", "is-network-error"] });
