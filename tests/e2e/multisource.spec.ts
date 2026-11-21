import { test, expect, type APIRequestContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
const base = "http://127.0.0.1:8788";
async function auth() {
  return {
    "Cf-Access-Jwt-Assertion": await readFile(
      ".wrangler/e2e/editor-token",
      "utf8",
    ),
    Origin: base,
  };
}
const urls = [
  "https://clips.twitch.tv/MixedTwitch",
  "https://youtu.be/abcdefghijk",
  "https://youtube.com/shorts/abcdefghijl",
  "https://x.com/demo/status/123",
  "https://twitter.com/demo/status/124",
];
async function seed(request: APIRequestContext, date: string) {
  const r = await request.post("/admin/publish", {
    headers: await auth(),
    data: {
      revision: 0,
      edition: {
        date,
        title: "Selección multifuente",
        intro: "Contexto de prueba",
        hook: "Prueba",
        demo: true,
        reviewed: false,
        featured: "youtube:abcdefghijk",
        clips: urls.map((url, i) => ({
          url,
          title: "Fuente " + i,
          streamer: "Creador " + i,
          text: "Contexto " + i,
          category: "Detalles",
          orientation: i === 2 ? "portrait" : "auto",
        })),
      },
    },
  });
  expect(r.status()).toBe(200);
}
test("five links through private inbox, prepared selection, editor and explicit reviewed publication", async ({
  page,
  request,
}) => {
  const date = "2094-03-01",
    headers = await auth();
  await page.setExtraHTTPHeaders(headers);
  await page.goto("/admin/inbox?date=" + date);
  await page
    .getByLabel("Enlaces (uno por línea, máximo diez)")
    .fill(urls.join("\n"));
  await page
    .getByRole("button", { name: "Guardar fuentes", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Guardados: 5");
  expect((await request.get("/dia/" + date)).status()).toBe(404);
  await page
    .getByLabel("Enlaces (uno por línea, máximo diez)")
    .fill(urls.join("\n"));
  await page
    .getByRole("button", { name: "Guardar fuentes", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("duplicados: 5");
  const ids = [
    "MixedTwitch",
    "youtube:abcdefghijk",
    "youtube:abcdefghijl",
    "x:123",
    "x:124",
  ];
  for (const [i, id] of ids.entries()) {
    const form = page.locator('[data-candidate="' + id + '"]');
    await form
      .getByLabel("Título", { exact: true })
      .fill("Fuente editorial " + i);
    await form.getByLabel("Crédito del creador").fill("Creador " + i);
    await form.getByLabel("Contexto editorial").fill("Contexto propio " + i);
    await form
      .getByLabel("Categoría", { exact: true })
      .selectOption("Detalles");
    await form.getByRole("button", { name: "Guardar revisión" }).click();
    // The heading is server-rendered, so it only changes once the save has reloaded the page.
    await expect(page.locator('[data-candidate="' + id + '"] h2')).toHaveText(
      "Fuente editorial " + i,
    );
    await expect(page.locator("#selection h2")).toContainText("5/10");
  }
  await page
    .getByRole("button", { name: "Preparar selección", exact: true })
    .click();
  await page.getByRole("link", { name: "Cargar selección en editor" }).click();
  await expect(page.locator(".clip-input")).toHaveCount(5);
  await expect(page.getByRole("status")).toContainText(
    "No se ha guardado ni publicado",
  );
  await page.getByLabel("Título de la edición").fill("Edición revisada");
  await page.getByLabel("Entradilla").fill("Cinco fuentes con contexto");
  await page.getByLabel("Gancho aprobado para X").fill("Cinco momentos");
  const youtube = page.locator(".clip-input").nth(1);
  await youtube.getByLabel("Destacado de la edición").check();
  await page
    .getByRole("button", { name: "Publicar edición", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Confirma");
  expect((await request.get("/dia/" + date)).status()).toBe(404);
  await page.getByLabel("He revisado las fuentes").check();
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Borrador guardado");
  expect((await request.get("/dia/" + date)).status()).toBe(404);
  await page
    .getByRole("button", { name: "Publicar edición", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Edición publicada");
  await expect(page.locator("#post")).toHaveValue(/#clip-youtube:abcdefghijk/);
  // The confirm may fire right after load (async fetch), so the handler must exist before navigating.
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  await page.goto("/admin?selection=" + date);
  await expect(page.getByRole("status")).toContainText("cancelada");
  await page.reload();
  await expect(page.getByRole("status")).toContainText("cancelada");
  const before = await (
    await request.get("/admin/data?date=" + date, { headers })
  ).json();
  expect(before.revision).toBe(2);
  await page.goto("/admin?date=" + date);
  await page.getByLabel("ID del clip").fill("https://youtu.be/abcdefghijk");
  await page.getByRole("button", { name: "Retirar clip", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("retirado");
  const publicHTML = await (await request.get("/dia/" + date)).text();
  expect(publicHTML).not.toContain('id="clip-youtube:abcdefghijk"');
  expect(publicHTML).toContain('id="clip-MixedTwitch"');
});
for (const width of [320, 390, 768, 1440])
  test(`mixed official player adapters at ${width}px preserve layout, click-only X, single media and cancellation`, async ({
    browser,
    request,
  }) => {
    const date =
      "2094-04-" +
      (
        { 320: "01", 390: "02", 768: "03", 1440: "04" } as Record<
          number,
          string
        >
      )[width];
    await seed(request, date);
    const context = await browser.newContext({
      viewport: { width, height: 1100 },
      isMobile: width < 800,
      hasTouch: width < 800,
      reducedMotion: "reduce",
    });
    const errors: string[] = [];
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await context.route("https://www.youtube.com/iframe_api", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `window.YT={Player:class {constructor(frame,options){this.frame=frame;this.options=options;setTimeout(()=>options.events.onReady(),0);}mute(){}playVideo(){this.options.events.onStateChange({data:1});}destroy(){this.frame.remove();}}};window.onYouTubeIframeAPIReady();`,
      }),
    );
    await context.route("https://www.youtube.com/embed/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<html><body>Official player mock: controls and source retained</body></html>",
      }),
    );
    let xScripts = 0;
    await context.route("https://platform.twitter.com/widgets.js", (route) => {
      xScripts++;
      return route.fulfill({
        contentType: "text/javascript",
        body: `window.twttr={widgets:{createTweet:async(id,target)=>{const frame=document.createElement('iframe');frame.src='https://platform.twitter.com/embed/'+id;frame.title='Publicación X completa';target.append(frame);return frame;}}};`,
      });
    });
    await context.route("https://platform.twitter.com/embed/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<html><body>Post context, author and video controls mock</body></html>",
      }),
    );
    try {
      await page.goto("/dia/" + date);
      await expect(page.locator("iframe")).toHaveCount(0);
      expect(xScripts).toBe(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const card = page.locator('[id="clip-youtube:abcdefghijk"]');
      await card.scrollIntoViewIfNeeded();
      const geometry = () =>
        page.evaluate(() => ({
          y: scrollY,
          rail: document.querySelector("#clips-rail")!.scrollLeft,
          cards: Array.from(document.querySelectorAll(".catalog-card")).map(
            (c) => {
              const r = c.getBoundingClientRect();
              return [r.x, r.y, r.width, r.height];
            },
          ),
          height: document.documentElement.scrollHeight,
        }));
      await card.locator("[data-preview-toggle]").focus();
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const before = await geometry();
      await page.keyboard.press("Enter");
      await expect(page.locator(".card-preview-layer iframe")).toHaveCount(1);
      expect(await geometry()).toEqual(before);
      const frame = page.locator(".card-preview-layer iframe");
      expect(await frame.getAttribute("referrerpolicy")).toBe(
        "strict-origin-when-cross-origin",
      );
      const box = await frame.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(200);
      expect(box!.height).toBeGreaterThanOrEqual(200);
      await expect(page.locator("iframe")).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(page.locator("iframe")).toHaveCount(0);
      await expect(card.locator("[data-preview-toggle]")).toBeFocused();
      expect(await geometry()).toEqual(before);
      const x = page.locator('[id="clip-x:123"]');
      await x.scrollIntoViewIfNeeded();
      await x.hover();
      await page.waitForTimeout(600);
      expect(xScripts).toBe(0);
      await x.locator("[data-preview-toggle]").dispatchEvent("click");
      await expect(
        page.locator('iframe[title="Publicación X completa"]'),
      ).toHaveCount(1);
      expect(xScripts).toBe(1);
      await expect(page.locator("iframe")).toHaveCount(1);
      await page
        .frameLocator('iframe[title="Publicación X completa"]')
        .locator("body")
        .click();
      await expect(page.locator(".card-preview-layer iframe")).toHaveCount(1);
      // Browser focus into a cross-origin player may hide relatedTarget.
      await page.locator(".card-preview-layer [data-preview-close]").focus();
      await page.keyboard.press("Escape");
      await expect(page.locator("iframe")).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("shared X mobile URL can be captured, selected, prepared and loaded into editor", async ({
  page,
  request,
}) => {
  const date = "2094-05-01";
  await page.setExtraHTTPHeaders(await auth());
  await page.goto("/admin/inbox?date=" + date);
  await page
    .getByLabel("Enlaces (uno por línea, máximo diez)")
    .fill(
      "https://x.com/LaTwitchance/status/2123221655715500442?a=mT-Cem3lEJP2T577VF0&s=35",
    );
  await page
    .getByRole("button", { name: "Guardar fuentes", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Guardados: 1");
  const candidate = page.locator('[data-candidate="x:2123221655715500442"]');
  await expect(
    candidate.getByRole("link", { name: "Revisar original" }),
  ).toHaveAttribute(
    "href",
    "https://x.com/LaTwitchance/status/2123221655715500442",
  );
  await expect(
    candidate.getByRole("button", { name: "Quitar de selección", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#selection h2")).toContainText("1/10");
  await page
    .getByRole("button", { name: "Preparar selección", exact: true })
    .click();
  await page.getByRole("link", { name: "Cargar selección en editor" }).click();
  await expect(page.locator('.clip-input [name="url"]')).toHaveValue(
    "https://x.com/LaTwitchance/status/2123221655715500442",
  );
  await expect(page.getByRole("status")).toContainText(
    "No se ha guardado ni publicado",
  );
  expect((await request.get("/dia/" + date)).status()).toBe(404);
});
