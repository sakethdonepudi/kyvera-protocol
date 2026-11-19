import { defineConfig } from "vitest/config";
import path from "node:path";

const root = process.cwd();
const alias = {
  "@kyvera/core": path.resolve(root, "packages/core/src/index.ts"),
  "@kyvera/bch": path.resolve(root, "packages/bch/src/index.ts"),
  "@kyvera/nostr": path.resolve(root, "packages/nostr/src/index.ts"),
  "@kyvera/verifier": path.resolve(root, "packages/verifier/src/index.ts"),
  "@kyvera/sdk": path.resolve(root, "packages/sdk/src/index.ts"),
  "@kyvera/wallet-bch": path.resolve(root, "packages/wallet-bch/src/index.ts"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 20_000,
    sequence: { concurrent: false },
  },
});
