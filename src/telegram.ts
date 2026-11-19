// Shared pure extraction and owner policy; no Telegram traffic runs inside the Worker.
export interface Owner {
  chat: string;
  user: string;
}
export function ownerUpdate(update: any, owner: Owner): boolean {
  const message =
    update?.callback_query?.message ||
    update?.message ||
    update?.edited_message;
  const from = update?.callback_query?.from || message?.from;
  return (
    !!message &&
    message.chat?.type === "private" &&
    String(message.chat.id) === owner.chat &&
    String(from?.id) === owner.user &&
    !from?.is_bot
  );
}
export function extractURLs(message: any): {
  urls: string[];
  overflow: number;
} {
  const found: string[] = [];
  for (const [text, entities] of [
    [message.text, message.entities],
    [message.caption, message.caption_entities],
  ]) {
    if (typeof text !== "string") continue;
    for (const entity of Array.isArray(entities)
      ? entities.slice(0, 100)
      : []) {
      if (entity.type === "text_link" && typeof entity.url === "string")
        found.push(entity.url);
      if (
        entity.type === "url" &&
        Number.isSafeInteger(entity.offset) &&
        Number.isSafeInteger(entity.length) &&
        entity.offset >= 0 &&
        entity.length > 0
      )
        found.push(text.slice(entity.offset, entity.offset + entity.length));
    }
    found.push(
      ...(text.match(/https?:\/\/[^\s<>]+/g) || []).map((url) =>
        url.replace(/[),.!?;]+$/, ""),
      ),
    );
  }
  const unique = [...new Set(found)];
  return {
    urls: unique.slice(0, 10),
    overflow: Math.max(0, unique.length - 10),
  };
}
export function retryDelay(attempt: number, retryAfter = 0): number {
  return Math.max(
    Math.min(300_000, 1000 * 2 ** Math.min(9, Math.max(0, attempt))),
    Math.min(86_400_000, Math.max(0, retryAfter) * 1000),
  );
}
// Discard forwarding attribution, nested replies, files and unrelated Telegram fields.
export function minimalUpdate(update: any): Record<string, unknown> {
  const message = (m: any) =>
    m && {
      chat: { id: m.chat?.id, type: m.chat?.type },
      from: { id: m.from?.id, is_bot: m.from?.is_bot },
      ...(typeof m.text === "string" ? { text: m.text.slice(0, 4096) } : {}),
      ...(typeof m.caption === "string"
        ? { caption: m.caption.slice(0, 1024) }
        : {}),
      ...Object.fromEntries(
        ["entities", "caption_entities"]
          .filter((key) => Array.isArray(m[key]))
          .map((key) => [
            key,
            m[key].slice(0, 100).map((e: any) => ({
              type: e.type,
              offset: e.offset,
              length: e.length,
              ...(typeof e.url === "string"
                ? { url: e.url.slice(0, 501) }
                : {}),
            })),
          ]),
      ),
    };
  return {
    update_id: update.update_id,
    ...(update.message ? { message: message(update.message) } : {}),
    ...(update.edited_message
      ? { edited_message: message(update.edited_message) }
      : {}),
    ...(update.callback_query
      ? {
          callback_query: {
            from: {
              id: update.callback_query.from?.id,
              is_bot: update.callback_query.from?.is_bot,
            },
            message: message(update.callback_query.message),
            data:
              typeof update.callback_query.data === "string"
                ? update.callback_query.data.slice(0, 65)
                : "",
          },
        }
      : {}),
  };
}
