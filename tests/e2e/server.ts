// Ephemeral integration server: production entry, real signed editor JWT, local D1.
import { fixtureJPEG } from "../fixtures/enrichment";
import { createHash } from "node:crypto";
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
let clipRequests = 0;
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    script: await readFile(".wrangler/e2e/worker.js", "utf8"),
    compatibilityDate: "2026-11-01",
    host: "127.0.0.1",
    port: 8788,
    d1Databases: ["DB"],
    bindings: {
      PUBLIC_ORIGIN: "http://127.0.0.1:8788",
      ACCESS_ISSUER: issuer,
      ACCESS_AUDIENCE: "e2e-editor",
      TWITCH_CLIENT_ID: "e2e-fixture-client",
      TWITCH_CLIENT_SECRET: "e2e-fixture-secret",
    },
    outboundService: async (request) => {
      const url = new URL(request.url);
      const reply = (value: unknown, status = 200) =>
        new RuntimeResponse(JSON.stringify(value), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      if (url.origin === issuer && url.pathname === "/cdn-cgi/access/certs")
        return reply({ keys: [jwk] });
      if (
        url.href === "https://id.twitch.tv/oauth2/token" &&
        request.method === "POST"
      )
        return reply({
          access_token: "e2e-fixture-token",
          token_type: "bearer",
          expires_in: 3600,
        });
      if (
        url.origin === "https://api.twitch.tv" &&
        url.pathname === "/helix/games"
      )
        return reply({ data: [{ id: "123456", name: "Grand Theft Auto VI" }] });
      if (
        url.origin === "https://api.twitch.tv" &&
        url.pathname === "/helix/clips"
      ) {
        clipRequests++;
        if (clipRequests === 1)
          return reply({ message: "fixture rate limit" }, 429);
        return reply({
          data: [
            {
              id: "ImportedJourney",
              url: "https://clips.twitch.tv/ImportedJourney",
              broadcaster_name: "Creador importado demo",
              title: "Fuente <img src=x> de prueba",
              language: "es",
              game_id: "123456",
              created_at: new Date(
                Date.parse(url.searchParams.get("ended_at")!) - 60000,
              ).toISOString(),
              duration: 25,
              view_count: clipRequests * 10,
            },
          ],
          pagination: {},
        });
      }
      return reply({ error: "Unexpected test outbound request" }, 500);
    },
  }),
);
const db = await runtime.getD1Database("DB");
await db.exec(
  (
    await Promise.all(
      [
        "0001_editions.sql",
        "0002_twitch.sql",
        "0003_candidate_thumbnails.sql",
        "0004_manual_inbox.sql",
        "0005_x_enrichment.sql",
        "0006_auto_import.sql",
        "0007_x_posts.sql",
        "0008_creator_credit.sql",
      ].map((name) => readFile("migrations/" + name, "utf8")),
    )
  )
    .join(" ")
    .replace(/\n/g, " "),
);

// Deterministic local enrichment fixture; no browser, provider or model network in CI.
const fixtureImage = Buffer.from(fixtureJPEG, "base64"),
  fixtureHash = createHash("sha256").update(fixtureImage).digest("hex");
await db
  .prepare(
    "INSERT INTO manual_candidates(id,provider,source_id,url,captured_date,created_at) VALUES(?,?,?,?,?,?)",
  )
  .bind(
    "x:987654321",
    "x",
    "987654321",
    "https://x.com/fixture/status/987654321",
    "2093-05-10",
    "2093-05-10T00:00:00Z",
  )
  .run();
await db
  .prepare("INSERT INTO enrichment_assets VALUES(?,?,?)")
  .bind(fixtureHash, fixtureImage, Date.now())
  .run();
await db
  .prepare(
    "INSERT INTO enrichment_jobs(candidate,status,updated_at) VALUES(?,'complete',?)",
  )
  .bind("x:987654321", Date.now())
  .run();
await db
  .prepare("INSERT INTO enrichment_results VALUES(?,?,?)")
  .bind(
    "x:987654321",
    JSON.stringify({
      extraction: {
        postId: "987654321",
        text: "El streamer Fixture logra una maniobra.",
        author: "Cuenta de noticias",
        handle: "@noticias",
        tags: [],
        comments: [],
        commentsRequested: 10,
        commentsReason: "Acceso público bloqueado; no se han leído respuestas",
        width: 480,
        height: 480,
        dimensionSource: "intrinsic",
        imageType: "provider_poster",
      },
      suggestion: {
        title: "Una maniobra del streamer",
        streamer: "Fixture",
        text: "La publicación atribuye una maniobra al streamer Fixture.",
        category: "Jugadas",
        evidence: {
          title: "maniobra",
          streamer: "El streamer Fixture",
          text: "maniobra",
          category: "maniobra",
        },
      },
      thumbnail: "/media/enrichment/" + fixtureHash + ".jpg",
      modelStatus: "complete",
    }),
    Date.now(),
  )
  .run();

await writeFile(".wrangler/e2e/editor-token", token, { mode: 0o600 });
await runtime.ready;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, async () => {
    await runtime.dispose();
    process.exit(0);
  });
