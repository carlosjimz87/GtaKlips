import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  confirmInitialFrame,
  targetWithMedia,
} from "../../src/enrichment-runner";
import {
  targetDOM,
  publicReplies,
  observeEarlyMedia,
} from "../../src/enrichment-dom";
const auth = async () => ({
  "Cf-Access-Jwt-Assertion": await readFile(
    ".wrangler/e2e/editor-token",
    "utf8",
  ),
  Origin: "http://127.0.0.1:8788",
});
test("public target DOM excludes parent/quote text, and replies require visible conversation membership", async ({
  page,
}) => {
  await page.route("**/*", (route) => route.abort());
  await page.setContent(
    `<article><a href="https://x.com/parent/status/1"><time>parent</time></a><div data-testid="tweetText">Wrong parent</div></article><article><a href="https://x.com/repost"><svg></svg></a><a href="https://x.com/repost"><span>Cuenta</span></a><a href="https://x.com/repost">@repost</a><div data-testid="tweetText">Texto exacto del objetivo</div><div data-testid="quoteTweet"><a href="https://x.com/quote/status/3"><time>quote</time></a><div data-testid="tweetText">Wrong quoted post</div></div><a href="https://x.com/repost/status/2?ref=embed"><time>date</time></a><video></video></article><article><a href="https://x.com/reply/status/4"><time>date</time></a><span>Replying to @repost</span><div data-testid="tweetText">Respuesta pública</div></article><article><a href="https://x.com/unrelated/status/5"><time>date</time></a><div data-testid="tweetText">Recommended unrelated post</div></article>`,
  );
  const data = await page.evaluate(targetDOM, "2");
  expect(data.text).toBe("Texto exacto del objetivo");
  expect(data.author).toBe("Cuenta");
  expect(data.handle).toBe("@repost");
  expect(data.articleIndex).toBe(1);
  expect(
    await page.evaluate(publicReplies, { postId: "2", handle: "@repost" }),
  ).toEqual(["Respuesta pública"]);
  await expect(page.evaluate(targetDOM, "3")).rejects.toThrow(
    "Target public article not verified",
  );
  await expect(page.evaluate(targetDOM, "999")).rejects.toThrow(
    "Target public article not verified",
  );
});
test("private proposal polls without discarding edits, applies explicit missing fields and loads persisted editor fields", async ({
  page,
  request,
}) => {
  let polls = 0;
  await page.route("**/admin/inbox/enrichment?**", async (route) => {
    const response = await route.fetch(),
      data = await response.json();
    if (data.job) data.job.status = "running";
    polls++;
    await route.fulfill({ response, json: data });
  });
  await page.setExtraHTTPHeaders(await auth());
  await page.goto("/admin/inbox?date=2093-05-10&captured=2093-05-10");
  const form = page.locator('[data-candidate="x:987654321"]'),
    panel = form.locator("[data-enrichment]");
  await expect(panel).toContainText("Comentarios: 0/10");
  await expect(panel).toContainText("no se han leído respuestas");
  await expect(panel).toContainText("no implica autoría");
  await expect(panel).toContainText("provider_poster");
  await expect(panel.locator("img")).toBeVisible();
  const image = await panel.locator("img").getAttribute("src");
  expect((await request.get(image!)).status()).toBe(401);
  expect(
    (
      await request.get(
        image!.replace("/admin/enrichment-assets/", "/media/enrichment/"),
      )
    ).status(),
  ).toBe(404);
  await form
    .getByLabel("Título", { exact: true })
    .fill("Título manual sin guardar");
  await page.waitForTimeout(5200);
  expect(polls).toBeGreaterThanOrEqual(2);
  await expect(form.getByLabel("Título", { exact: true })).toHaveValue(
    "Título manual sin guardar",
  );
  await expect(
    panel.getByRole("button", { name: "Aplicar campos vacíos" }),
  ).toBeDisabled();
  await panel.getByRole("button", { name: "Analizar / reintentar" }).click();
  await expect(page.locator("#inbox-status")).toContainText("Guarda primero");
  await form.getByRole("button", { name: "Guardar revisión" }).click();
  await expect(form.getByLabel("Título", { exact: true })).toHaveValue(
    "Título manual sin guardar",
  );
  await expect(
    panel.getByRole("button", { name: "Aplicar campos vacíos" }),
  ).toBeEnabled();
  await panel.getByRole("button", { name: "Aplicar campos vacíos" }).click();
  await expect(form.getByLabel("Título", { exact: true })).toHaveValue(
    "Título manual sin guardar",
  );
  await expect(form.getByLabel("Crédito del creador")).toHaveValue("Fixture");
  await expect(form.getByLabel("Contexto editorial")).toHaveValue(
    "La publicación atribuye una maniobra al streamer Fixture.",
  );
  await expect(form.getByLabel("Orientación")).toHaveValue("square");
  await expect(form.getByLabel("Revisión")).toHaveValue("pending");
  await form.getByRole("button", { name: "Seleccionar", exact: true }).click();
  await page.getByRole("button", { name: "Preparar selección" }).click();
  await page.getByRole("link", { name: "Cargar selección en editor" }).click();
  await expect(page.locator("[name=streamer]")).toHaveValue("Fixture");
  await expect(page.locator("[name=orientation]")).toHaveValue("square");
  await expect(page.locator("[name=thumbnail]")).toHaveValue(
    /\/media\/enrichment\/[a-f0-9]{64}\.jpg/,
  );
  expect((await request.get("/dia/2093-05-10")).status()).toBe(404);
});

test("initial-frame label requires a presented near-zero video frame, never only readyState or poster", async ({
  page,
}) => {
  await page.setContent(
    '<video poster="data:image/gif;base64,R0lGODlhAQABAAAAACw="></video>',
  );
  await page.locator("video").evaluate((v: any) => {
    Object.defineProperties(v, {
      readyState: { value: 2, configurable: true },
      currentTime: { get: () => 0, set: () => {}, configurable: true },
      play: {
        value: () => Promise.reject(Error("blocked")),
        configurable: true,
      },
      pause: { value: () => {}, configurable: true },
    });
  });
  expect(await page.locator("video").evaluate(confirmInitialFrame)).toBe(false);
  await page.locator("video").evaluate((v: any) => {
    Object.defineProperties(v, {
      play: { value: () => Promise.resolve(), configurable: true },
      requestVideoFrameCallback: {
        value: (cb: any) => {
          setTimeout(() => cb(0, { mediaTime: 0 }), 0);
          return 1;
        },
        configurable: true,
      },
    });
  });
  expect(await page.locator("video").evaluate(confirmInitialFrame)).toBe(true);
  await page.locator("video").evaluate((v: any) => {
    Object.defineProperty(v, "requestVideoFrameCallback", {
      value: (cb: any) => {
        setTimeout(() => cb(0, { mediaTime: 3 }), 0);
        return 1;
      },
    });
  });
  expect(await page.locator("video").evaluate(confirmInitialFrame)).toBe(false);
});

test("verified video-only target retains empty text and author after the player disappears", async ({
  page,
}) => {
  await page.setContent(
    '<article><a href="https://x.com/author"><svg></svg></a><a href="https://x.com/author">Autor público</a><a href="https://x.com/author">@author</a><a href="https://x.com/author/status/88"><time>date</time></a><video></video><article><div data-testid="tweetText">Texto de cita anidada</div><video></video></article></article>',
  );
  const data = await page.evaluate(targetDOM, "88");
  expect(data.text).toBe("");
  expect(data.author).toBe("Autor público");
  await page
    .locator("video")
    .evaluateAll((nodes) => nodes.forEach((n) => n.remove()));
  const after = await page.evaluate(targetDOM, "88");
  expect(after.text).toBe("");
  expect(after.author).toBe("Autor público");
});

test("collector waits for a late player and refreshes its official poster snapshot", async ({
  page,
}) => {
  await page.route("**/*", (route) => route.abort());
  await page.setContent(
    '<article><a href="https://x.com/author/status/99"><time>date</time></a><div data-testid="tweetText">Texto público listo antes del vídeo</div></article>',
  );
  await page.evaluate(() => {
    setTimeout(() => {
      const video = document.createElement("video");
      video.poster =
        "https://pbs.twimg.com/amplify_video_thumb/123/img/fixture.jpg";
      document.querySelector("article")!.appendChild(video);
    }, 350);
  });
  const data = await targetWithMedia(page.mainFrame(), "99");
  expect(data.text).toBe("Texto público listo antes del vídeo");
  expect(data.poster).toBe(
    "https://pbs.twimg.com/amplify_video_thumb/123/img/fixture.jpg",
  );
});

test("early public media snapshot survives SDK player removal under the fixed network budget", async ({
  page,
}) => {
  await page.route("**/*", (route) => route.abort());
  await page.setContent(
    '<article><a href="https://x.com/author/status/100"><time>date</time></a><div data-testid="tweetText">Fuente</div><div data-testid="videoComponent" style="width:320px;height:0px"></div></article>',
  );
  await page.evaluate(observeEarlyMedia, "100");
  await page.evaluate(() => {
    const v = document.createElement("video");
    v.style.cssText = "width:100%;height:100%";
    v.poster = "https://pbs.twimg.com/amplify_video_thumb/123/img/initial.jpg";
    document.querySelector('[data-testid="videoComponent"]')!.appendChild(v);
  });
  await page.waitForTimeout(25);
  const transient = await page.evaluate(
    () => (globalThis as any).__enrichmentMedia,
  );
  expect(transient.width).toBe(0);
  expect(transient.height).toBe(0);
  await page
    .locator('[data-testid="videoComponent"]')
    .evaluate((el: HTMLElement) => {
      el.style.height = "180px";
    });
  await page.evaluate(() => {
    const parent = document.createElement("article");
    parent.innerHTML =
      '<a href="https://x.com/other/status/2"><time>parent</time></a><div data-testid="tweetText">Enlace en texto a <a href="https://x.com/author/status/100">la fuente</a></div><video style="width:600px;height:600px" poster="https://pbs.twimg.com/amplify_video_thumb/123/img/wrong-parent.jpg"></video>';
    document.body.appendChild(parent);
  });
  await page.waitForTimeout(25);
  await page
    .locator("video")
    .first()
    .evaluate((v) => v.remove());
  const snapshot = await page.evaluate(
    () => (globalThis as any).__enrichmentMedia,
  );
  expect(snapshot.postId).toBe("100");
  expect(snapshot.poster).toBe(
    "https://pbs.twimg.com/amplify_video_thumb/123/img/initial.jpg",
  );
  expect(snapshot.width).toBe(320);
  expect(snapshot.height).toBe(180);
  expect(snapshot.dimensionSource).toBe("player");
  expect((await page.evaluate(targetDOM, "100")).text).toBe("Fuente");
});
