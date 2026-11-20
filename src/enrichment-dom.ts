// Runs inside the isolated provider iframe. Keep self-contained for Playwright serialization.
export function targetDOM(postId: string) {
  const articles = Array.from(document.querySelectorAll("article"));
  const target = articles.find(
    (article) =>
      !article.parentElement?.closest("article") &&
      Array.from(article.querySelectorAll("time")).some(
        (time) =>
          time.closest("article") === article &&
          !time.closest('[data-testid="quoteTweet"]') &&
          new RegExp("^/[^/]+/status/" + postId + "$").test(
            new URL(time.closest("a")?.href || "", location.href).pathname,
          ),
      ),
  );
  if (!target) throw Error("Target public article not verified");

  const textNode = Array.from(
    target.querySelectorAll('[data-testid="tweetText"]'),
  ).find(
    (node) =>
      node.closest("article") === target &&
      !node.closest('[data-testid="quoteTweet"]'),
  );

  const anchors = (
    Array.from(target.querySelectorAll("a[href]")) as HTMLAnchorElement[]
  ).filter(
    (node) =>
      node.closest("article") === target &&
      !node.closest('[data-testid="quoteTweet"]'),
  );
  const handleAnchor = anchors.find((a) =>
    /^@[A-Za-z0-9_]{1,30}$/.test(a.textContent?.trim() || ""),
  );
  const authorAnchor = handleAnchor
    ? anchors.find(
        (a) =>
          new URL(a.href).pathname.toLowerCase() ===
            new URL(handleAnchor.href).pathname.toLowerCase() &&
          a !== handleAnchor &&
          !!a.textContent?.trim() &&
          !a.textContent?.trim().startsWith("@"),
      )
    : null;
  return {
    articleIndex: articles.indexOf(target),
    text: textNode?.textContent || "",
    author:
      authorAnchor?.textContent
        ?.replace(handleAnchor?.textContent || "", "")
        .trim() || "",
    poster:
      Array.from(target.querySelectorAll("video")).find(
        (node) =>
          node.closest("article") === target &&
          !node.closest('[data-testid="quoteTweet"]'),
      )?.poster || "",
    handle: handleAnchor?.textContent || "",
  };
}
export function publicReplies({
  postId,
  handle,
}: {
  postId: string;
  handle: string;
}) {
  const articles = Array.from(document.querySelectorAll("article"));
  let target = false;
  const out: string[] = [];
  for (const article of articles) {
    const time = Array.from(article.querySelectorAll("time")).find(
        (t) =>
          t.closest("article") === article &&
          !t.closest('[data-testid="quoteTweet"]'),
      ),
      link = time?.closest("a");
    let id = "";
    try {
      id =
        /\/status\/(\d+)$/.exec(
          new URL(link?.href || "", location.href).pathname,
        )?.[1] || "";
    } catch {
      /* no post */
    }
    if (id === postId) {
      target = true;
      continue;
    }
    if (!target || !id || !handle) continue;
    const textNode = Array.from(
      article.querySelectorAll('[data-testid="tweetText"]'),
    ).find(
      (n) =>
        n.closest("article") === article &&
        !n.closest('[data-testid="quoteTweet"]'),
    );
    if (!textNode) continue;
    // Public conversation membership must be visible, not inferred from page position.
    const prefix =
      article.textContent?.split(textNode.textContent || "")[0] || "";
    if (
      !/(Replying to|En respuesta a)/i.test(prefix) ||
      !prefix.includes(handle)
    )
      continue;
    out.push(textNode.textContent || "");
  }
  return out;
}
// Installed before provider scripts: retain public media facts if the SDK removes
// its player after a bounded stream is refused. No full video bytes are retained.
export function observeEarlyMedia(postId: string) {
  new MutationObserver(() => {
    for (const article of Array.from(document.querySelectorAll("article"))) {
      if (article.parentElement?.closest("article")) continue;
      const ownLink = Array.from(article.querySelectorAll("a[href]")).some(
        (a) =>
          a.closest("article") === article &&
          (a.parentElement === article ||
            Array.from(a.querySelectorAll("time")).some(
              (t) =>
                t.closest("article") === article &&
                !t.closest('[data-testid="quoteTweet"]'),
            )) &&
          !a.closest('[data-testid="quoteTweet"]') &&
          new RegExp("^/[^/]+/status/" + postId + "$").test(
            new URL((a as HTMLAnchorElement).href, location.href).pathname,
          ),
      );
      if (!ownLink) continue;
      const video = Array.from(article.querySelectorAll("video")).find(
        (v) =>
          v.closest("article") === article &&
          !v.closest('[data-testid="quoteTweet"]'),
      );
      const player =
        video ||
        Array.from(
          article.querySelectorAll('[data-testid="videoComponent"]'),
        ).find(
          (v) =>
            v.closest("article") === article &&
            !v.closest('[data-testid="quoteTweet"]'),
        );
      const box = player?.getBoundingClientRect(),
        state = globalThis as typeof globalThis & {
          __enrichmentMedia?: {
            postId: string;
            poster: string;
            width: number;
            height: number;
            dimensionSource: "intrinsic" | "player" | "unavailable";
          };
        };
      const previous = state.__enrichmentMedia;
      const intrinsic = !!video?.videoWidth && !!video?.videoHeight;
      state.__enrichmentMedia = {
        postId,
        poster: video?.poster || previous?.poster || "",
        width: intrinsic
          ? video!.videoWidth
          : previous?.dimensionSource === "intrinsic"
            ? previous.width
            : box && box.width >= 100 && box.height >= 100
              ? Math.round(box.width)
              : previous?.width || 0,
        height: intrinsic
          ? video!.videoHeight
          : previous?.dimensionSource === "intrinsic"
            ? previous.height
            : box && box.width >= 100 && box.height >= 100
              ? Math.round(box.height)
              : previous?.height || 0,
        dimensionSource:
          intrinsic || previous?.dimensionSource === "intrinsic"
            ? "intrinsic"
            : box && box.width >= 100 && box.height >= 100
              ? "player"
              : previous?.dimensionSource || "unavailable",
      };
    }
  }).observe(document, { subtree: true, childList: true, attributes: true });
  document.addEventListener(
    "loadedmetadata",
    () =>
      document.documentElement?.setAttribute(
        "data-enrichment-media-update",
        String(Date.now()),
      ),
    true,
  );
  addEventListener("resize", () =>
    document.documentElement?.setAttribute(
      "data-enrichment-media-update",
      String(Date.now()),
    ),
  );
}
