import { demoNeedsWrite } from "./demo-policy.mjs";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";

// Deliberately local-only. There is no remote target or reset option.
if (process.argv.length > 2)
  throw Error("La demo solo admite ejecución local sin argumentos.");
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const config = JSON.parse(
  readFileSync(join(root, "wrangler.local.jsonc"), "utf8").replace(
    /,\s*([}\]])/g,
    "$1",
  ),
);
const origin = new URL(config.vars.PUBLIC_ORIGIN);
if (
  origin.protocol !== "http:" ||
  !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) ||
  config.main !== "src/local.ts"
)
  throw Error("Se requiere la configuración de desarrollo local.");
const sources = JSON.parse(
  readFileSync(join(root, "demo/twitch-clips.json"), "utf8"),
);
if (sources.length !== 5 || new Set(sources.map((c) => c.id)).size !== 5)
  throw Error("Se requieren cinco fuentes distintas.");
for (const c of sources) {
  if (
    !/^[A-Za-z0-9_-]{1,100}$/.test(c.id) ||
    c.url !== "https://clips.twitch.tv/" + c.id ||
    typeof c.streamer !== "string" ||
    !c.streamer ||
    c.streamer.length > 80
  )
    throw Error("Fuente de demostración no válida.");
  const image = new URL(c.thumbnail);
  if (
    image.protocol !== "https:" ||
    image.username ||
    image.password ||
    image.port ||
    image.hash ||
    image.search ||
    ![
      "static-cdn.jtvnw.net",
      "clips-media-assets2.twitch.tv",
      "clips-media-assets.twitch.tv",
    ].includes(image.hostname) ||
    !/\.(jpg|jpeg|png|webp)$/i.test(image.pathname)
  )
    throw Error("Miniatura no válida.");
  if (!Number.isFinite(c.duration) || c.duration <= 0 || c.duration > 3600)
    throw Error("Duración no válida.");
}
const wrangler = join(root, "node_modules/wrangler/bin/wrangler.js");
function sql(command) {
  const output = execFileSync(
    process.execPath,
    [
      wrangler,
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      "wrangler.local.jsonc",
      "--command",
      command,
      "--json",
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  const response = JSON.parse(output);
  if (!Array.isArray(response) || response.some((r) => !r.success))
    throw Error("D1 local no confirmó la operación.");
  return response.flatMap((r) => r.results || []);
}
const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const rows = sql(
  "SELECT date,revision,draft,published,published_at FROM editions ORDER BY date",
);
const backupDir = join(root, ".wrangler/demo-backups");
mkdirSync(backupDir, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().replaceAll(":", "-");
writeFileSync(
  join(backupDir, stamp + ".json"),
  JSON.stringify(
    { format: 1, capturedAt: new Date().toISOString(), editions: rows },
    null,
    2,
  ),
  { mode: 0o600 },
);
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const titles = [
  "Hasta una nevera tiene su momento",
  "Un aterrizaje fuera de guion",
  "Bullet Time, de cerca",
  "GTA 6 borrado",
  "Reset",
];
const genres = ["Detalles", "Jugadas", "Detalles", "Reacciones", "Fails"];
const edition = {
  demoSeed: "catalog-v1",
  date,
  title: "GTA VI, fuera del guion.",
  intro:
    "Cinco clips, sus creadores y el siguiente momento que te apetece ver. Una selección de demostración con enlaces reales de Twitch.",
  hook: "El directo no siempre sigue el guion. Cinco clips de prueba, con sus fuentes originales.",
  demo: true,
  reviewed: false,
  featured: sources[1].id,
  clips: sources.map((c, i) => ({
    id: c.id,
    url: c.url,
    streamer: c.streamer,
    title: titles[i],
    text: `Título original: «${c.sourceTitle}». Abre el clip de ${c.streamer} para ver el contexto completo.`,
    category: genres[i],
    thumbnail: c.thumbnail,
    duration: c.duration,
  })),
};
const existing = rows.find((r) => r.date === date);
const json = JSON.stringify(edition);
const needsWrite = demoNeedsWrite(existing, json);
if (needsWrite) {
  const result = sql(
    `INSERT INTO editions(date,draft,published,published_at) VALUES(${literal(date)},${literal(json)},${literal(json)},${literal(new Date().toISOString())}) ON CONFLICT(date) DO UPDATE SET draft=excluded.draft,published=excluded.published,published_at=excluded.published_at,revision=editions.revision+1 WHERE editions.revision=${existing?.revision || 0} AND json_extract(editions.draft,'$.demoSeed')='catalog-v1' RETURNING revision`,
  );
  if (result.length !== 1)
    throw Error(
      "La edición cambió mientras se preparaba. Recarga antes de repetir.",
    );
}
function automated(raw) {
  if (!raw) return false;
  const e = JSON.parse(raw);
  const knownTitles = [
    "Cinco momentos · edición de demostración",
    "CAMBIO PRIVADO",
    "<img src=x onerror=alert(1)>",
    "Importación demo con revisión manual",
  ];
  return (
    e.demo === true &&
    knownTitles.includes(e.title) &&
    Array.isArray(e.clips) &&
    e.clips.length > 0 &&
    e.clips.every((c) =>
      /^(DemoJourney\d+|SecurityDemo|ImportedJourney)$/.test(c.id),
    )
  );
}
let hidden = 0;
for (const row of rows) {
  if (row.date !== date && automated(row.draft) && automated(row.published)) {
    hidden += sql(
      `UPDATE editions SET published=NULL,published_at=NULL,revision=revision+1 WHERE date=${literal(row.date)} AND revision=${row.revision} RETURNING date`,
    ).length;
  }
}
const final = sql(
  `SELECT published FROM editions WHERE date=${literal(date)}`,
)[0];
if (final?.published !== json)
  throw Error("No se pudo confirmar la demo local.");
console.log(
  `Demo local preparada: ${date}, 5 fuentes reales. ${hidden} fixtures automáticos retirados de publicación y conservados como borradores.`,
);
console.log(
  "Respaldo de las ediciones anteriores: .wrangler/demo-backups/" +
    stamp +
    ".json",
);
console.log("Abrir: " + origin.origin + "/dia/" + date);
console.log(
  "La disponibilidad futura y el recuento de reproducciones dependen de Twitch.",
);
