import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { ownerUpdate, retryDelay, minimalUpdate } from "./telegram";
export interface RunnerConfig {
  token: string;
  chat: string;
  user: string;
  secret: string;
  origin: string;
}
export function runnerConfig(env: NodeJS.ProcessEnv): RunnerConfig {
  const token = env.TELEGRAM_BOT_TOKEN || "",
    chat = env.TELEGRAM_OWNER_CHAT_ID || "",
    user = env.TELEGRAM_OWNER_USER_ID || "",
    secret = env.LOCAL_BRIDGE_SECRET || "",
    origin = env.LOCAL_BRIDGE_ORIGIN || "http://127.0.0.1:8787";
  const url = new URL(origin);
  if (
    !/^\d+:[A-Za-z0-9_-]{20,}$/.test(token) ||
    !/^\d+$/.test(chat) ||
    !/^\d+$/.test(user) ||
    secret.length < 32 ||
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.origin !== origin
  )
    throw Error(
      "Configure the ignored local environment; see README. No credentials are printed.",
    );
  return { token, chat, user, secret, origin };
}
async function boundedJSON(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw Error("empty");
  let raw = "",
    bytes = 0;
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 262144) {
      await reader.cancel();
      throw Error("oversize");
    }
    raw += decoder.decode(value, { stream: true });
  }
  return JSON.parse(raw + decoder.decode());
}
export function createRunner(
  config: RunnerConfig,
  request: typeof fetch = fetch,
) {
  const owner = randomUUID();
  const internal = async (
    action: string,
    payload: Record<string, unknown> = {},
  ) => {
    const response = await request(
      config.origin + "/internal/telegram/" + action,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ owner, ...payload }),
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) throw Error("Local bridge unavailable or lease held");
    return boundedJSON(response);
  };
  const telegram = async (
    method: "getUpdates" | "sendMessage" | "answerCallbackQuery",
    payload: Record<string, unknown>,
  ) => {
    const response = await request(
      `https://api.telegram.org/bot${config.token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "error",
        signal: AbortSignal.timeout(
          method === "answerCallbackQuery" ? 5000 : 35000,
        ),
      },
    );
    return boundedJSON(response);
  };
  const drainOutbox = async () => {
    for (const row of await internal("outbox")) {
      await internal("lease");
      let ok = false,
        retryAfter = 0;
      try {
        const payload = JSON.parse(row.payload);
        const result = await telegram("sendMessage", {
          chat_id: config.chat,
          text: payload.text,
          reply_markup: payload.reply_markup,
          link_preview_options: { is_disabled: true },
        });
        ok = result.ok === true;
        retryAfter = Number(result.parameters?.retry_after) || 0;
      } catch {
        /* safe durable retry, never log provider responses */
      }
      await internal("ack", { id: row.id, ok, retryAfter });
      if (!ok) break;
    }
  };

  return {
    internal,
    async cycle(poll = true) {
      let lease = await internal("lease");
      // Previously committed replies are deliverable even if polling fails.
      await drainOutbox();
      lease = await internal("lease");
      if (poll) {
        const result = await telegram("getUpdates", {
          offset: lease.cursor,
          timeout: 25,
          limit: 10,
          allowed_updates: ["message", "callback_query", "edited_message"],
        });
        if (
          !result.ok ||
          !Array.isArray(result.result) ||
          result.result.length > 10
        )
          throw Object.assign(Error("Telegram polling unavailable"), {
            retryAfter: Number(result.parameters?.retry_after) || 0,
          });
        await internal("lease");
        for (const update of result.result.sort(
          (a: any, b: any) => a.update_id - b.update_id,
        )) {
          if (!Number.isSafeInteger(update?.update_id))
            throw Error("Malformed update");
          // Unauthorized content/IDs never cross the local bridge or reach providers.
          await internal("update", {
            update: ownerUpdate(update, config)
              ? minimalUpdate(update)
              : { update_id: update.update_id },
          });
          // Dismiss the Telegram spinner only after its effects are durable.
          // An expired/transient acknowledgement must never undo the update.
          if (
            ownerUpdate(update, config) &&
            typeof update.callback_query?.id === "string" &&
            update.callback_query.id.length <= 128
          ) {
            await telegram("answerCallbackQuery", {
              callback_query_id: update.callback_query.id,
            }).catch(() => {});
          }
        }
      }
      if (poll) await drainOutbox();
    },
  };
}
async function main() {
  const runner = createRunner(runnerConfig(process.env));
  if (process.argv.includes("--status")) {
    console.log(JSON.stringify(await runner.internal("health")));
    return;
  }
  let stopping = false,
    failures = 0;
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => {
      stopping = true;
    });
  const enrichment =
    process.env.ENRICHMENT_ENABLED !== "0"
      ? import("./enrichment-runner")
          .then(({ enrichmentConfig, enrichmentLoop }) =>
            enrichmentLoop(enrichmentConfig(process.env), () => stopping),
          )
          .catch(() => {
            console.error(
              "Local enrichment unavailable; receiver and manual editing remain available.",
            );
          })
      : Promise.resolve();
  console.log("Local owner-only receiver started. Stop with Ctrl-C.");
  try {
    while (!stopping) {
      try {
        await runner.cycle();
        failures = 0;
      } catch (error) {
        failures++;
        console.error(
          "Receiver temporarily unavailable; retrying without logging update or credentials.",
        );
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            retryDelay(failures, Number((error as any)?.retryAfter) || 0),
          ),
        );
      }
    }
  } finally {
    stopping = true;
    await enrichment;
    await runner.internal("release").catch(() => {});
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    console.error(
      "Receiver could not start. Check ignored local configuration and README.",
    );
    process.exitCode = 1;
  });
