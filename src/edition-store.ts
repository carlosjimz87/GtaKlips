import type { Env } from "./auth";
import { validate } from "./model";

// Both authenticated surfaces commit exactly the same validated snapshot.
export function editionWrite(
  env: Env,
  value: unknown,
  revision: number,
  publish: boolean,
) {
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw Error("Revisión no válida");
  const e = validate(value, publish),
    serialized = JSON.stringify(e);
  if (revision === 0)
    return env.DB.prepare(
      "INSERT INTO editions(date,draft,published,published_at) VALUES(?,?,?,?) ON CONFLICT(date) DO NOTHING RETURNING revision",
    ).bind(
      e.date,
      serialized,
      publish ? serialized : null,
      publish ? new Date().toISOString() : null,
    );
  return publish
    ? env.DB.prepare(
        "UPDATE editions SET draft=?,published=?,published_at=?,revision=revision+1 WHERE date=? AND revision=? RETURNING revision",
      ).bind(serialized, serialized, new Date().toISOString(), e.date, revision)
    : env.DB.prepare(
        "UPDATE editions SET draft=?,revision=revision+1 WHERE date=? AND revision=? RETURNING revision",
      ).bind(serialized, e.date, revision);
}
