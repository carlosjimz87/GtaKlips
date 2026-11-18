// Ephemeral integration server: production entry, real signed editor JWT, local D1.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import {
  Miniflare,
  convertV4MiniflareOptions,
  Response as RuntimeResponse,
} from "miniflare";

await mkdir(".wrangler/e2e", { recursive: true });
await build({
  entryPoints: ["src/index.ts"],
  outfile: ".wrangler/e2e/worker.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
});
const issuer = "https://e2e-test.cloudflareaccess.com";
const pair = await generateKeyPair("RS256");
const jwk = {
  ...(await exportJWK(pair.publicKey)),
  kid: "ephemeral-e2e",
  alg: "RS256",
};
const token = await new SignJWT({})
  .setProtectedHeader({ alg: "RS256", kid: "ephemeral-e2e" })
  .setIssuer(issuer)
  .setAudience("e2e-editor")
  .setSubject("test-editor")
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(pair.privateKey);
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    script: await readFile(".wrangler/e2e/worker.js", "utf8"),
    compatibilityDate: "2026-11-01",
    host: "127.0.0.1",
    port: 8787,
    d1Databases: ["DB"],
    bindings: {
      PUBLIC_ORIGIN: "http://127.0.0.1:8787",
      ACCESS_ISSUER: issuer,
      ACCESS_AUDIENCE: "e2e-editor",
    },
    outboundService: () =>
      new RuntimeResponse(JSON.stringify({ keys: [jwk] }), {
        headers: { "Content-Type": "application/json" },
      }),
  }),
);
const db = await runtime.getD1Database("DB");
await db.exec(
  (await readFile("migrations/0001_editions.sql", "utf8")).replace(/\n/g, " "),
);
await writeFile(".wrangler/e2e/editor-token", token, { mode: 0o600 });
await runtime.ready;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, async () => {
    await runtime.dispose();
    process.exit(0);
  });
