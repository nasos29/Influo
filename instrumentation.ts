/** Boot hook: Node-only work lives in instrumentation-node.ts (kept out of the edge bundle). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
