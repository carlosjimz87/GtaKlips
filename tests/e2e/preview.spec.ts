import { readFile } from "node:fs/promises";
import {
  test,
  expect,
  type Browser,
  type APIRequestContext,
  type BrowserContext,
} from "@playwright/test";

const runtimeErrors = new WeakMap<BrowserContext, string[]>();
async function closeContext(ctx: BrowserContext) {
  await ctx.close();
  expect(runtimeErrors.get(ctx)).toEqual([]);
}

async function seed(request: APIRequestContext, date: string) {
  const token = await readFile(".wrangler/e2e/editor-token", "utf8");
  const result = await request.post("/admin/publish", {
    headers: {
      "Cf-Access-Jwt-Assertion": token,
      Origin: "http://127.0.0.1:8788",
    },
    data: {
      revision: 0,
      edition: {
        date,
        title: "Vistas previas de prueba",
        intro: "Reproductor controlado para validar la interfaz.",
        hook: "Prueba",
        demo: true,
        reviewed: false,
        featured: "PreviewClip0",
        clips: Array.from({ length: 5 }, (_, i) => ({
          url: `https://clips.twitch.tv/PreviewClip${i}`,
          streamer: "Creador de prueba",
          title: `Clip de prueba ${i}`,
          text: "Contexto de demostración",
          category: "Jugadas",
        })),
      },
    },
  });
  expect(result.status()).toBe(200);
}
async function context(
  browser: Browser,
  options: Parameters<Browser["newContext"]>[0] = {},
) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
    ...options,
  });
  runtimeErrors.set(ctx, []);
  ctx.on("page", (page) =>
    page.on("pageerror", (error) =>
      runtimeErrors.get(ctx)!.push(error.message),
    ),
  );
  await ctx.route("https://clips.twitch.tv/embed?**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<html><body style="margin:0;background:#162821;color:white"><p>Reproductor simulado de Twitch</p><button style="position:fixed;right:12px;bottom:12px" onclick="document.documentElement.requestFullscreen()">Pantalla completa</button></body></html>',
    }),
  );
  return ctx;
}
async function assertFrame(ctx: BrowserContext) {
  const frame = ctx.pages()[0].locator("[data-preview-hero] iframe");
  await expect(frame).toHaveCount(1);
  const url = new URL((await frame.getAttribute("src"))!);
  expect(url.origin + url.pathname).toBe("https://clips.twitch.tv/embed");
  expect(url.searchParams.get("parent")).toBe("127.0.0.1");
  expect(url.searchParams.get("muted")).toBe("true");
  const box = (await frame.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(400);
  expect(box.height).toBeGreaterThanOrEqual(300);
  await expect(ctx.pages()[0].locator("iframe")).toHaveCount(1);
}
test("central screen: manual playback, Escape, fullscreen and hidden-page cleanup", async ({
  browser,
  request,
}) => {
  await seed(request, "2095-05-06");
  const ctx = await context(browser);
  try {
    const page = await ctx.newPage();
    await page.goto("/dia/2095-05-06");
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.locator("[data-preview-hero] [data-preview-toggle]").click();
    await assertFrame(ctx);
    await page
      .frameLocator("[data-preview-hero] iframe")
      .getByRole("button", { name: "Pantalla completa" })
      .click();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement?.tagName))
      .toBe("IFRAME");
    await page.evaluate(() => {
      dispatchEvent(new Event("resize"));
      dispatchEvent(new Event("scroll"));
    });
    await assertFrame(ctx);
    await page.evaluate(() => document.exitFullscreen());
    // A cross-origin frame keeps keyboard focus; return to the page's own Stop control.
    await page.locator("[data-preview-hero] [data-preview-toggle]").focus();
    await page.keyboard.press("Escape");
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.locator("[data-preview-hero] [data-preview-toggle]").click();
    await assertFrame(ctx);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator("iframe")).toHaveCount(0);
  } finally {
    await closeContext(ctx);
  }
});
for (const mode of ["reduce", "save-data"] as const)
  test(
    mode + " disables automatic media, retains deliberate playback",
    async ({ browser, request }) => {
      const date = mode === "reduce" ? "2095-05-07" : "2095-05-09";
      await seed(request, date);
      const ctx = await context(
        browser,
        mode === "reduce" ? { reducedMotion: "reduce" } : {},
      );
      try {
        if (mode === "save-data")
          await ctx.addInitScript(() => {
            Object.defineProperty(navigator, "connection", {
              value: { saveData: true, addEventListener() {} },
            });
          });
        const page = await ctx.newPage();
        await page.goto("/dia/" + date);
        await page.locator("#clip-PreviewClip0").hover();
        await page.waitForTimeout(800);
        await expect(page.locator("iframe")).toHaveCount(0);
        await page.locator("#clip-PreviewClip0 .clip-link").click();
        await assertFrame(ctx);
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.locator("iframe")).toHaveCount(0);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      } finally {
        await closeContext(ctx);
      }
    },
  );
test("touch does not autoplay; narrow Twitch is not embedded below its minimum", async ({
  browser,
  request,
}) => {
  await seed(request, "2095-05-08");
  const ctx = await context(browser, {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await ctx.newPage();
    await page.goto("/dia/2095-05-08");
    await page.locator("[data-preview-hero] [data-preview-toggle]").tap();
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.locator("[data-preview-hero]")).toHaveAttribute(
      "data-playback",
      "unavailable",
    );
    await expect(
      page.locator("[data-preview-hero] .preview-source"),
    ).toHaveAttribute("href", "https://clips.twitch.tv/PreviewClip0");
    await page.setViewportSize({ width: 768, height: 1100 });
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.locator("[data-preview-hero] [data-preview-toggle]").tap();
    await assertFrame(ctx);
    await page.keyboard.press("Escape");
    await expect(page.locator("iframe")).toHaveCount(0);
  } finally {
    await closeContext(ctx);
  }
});
test("hover is delayed and never creates a floating layer or changes card geometry", async ({
  browser,
  request,
}) => {
  await seed(request, "2095-05-10");
  const ctx = await context(browser);
  try {
    const page = await ctx.newPage();
    await page.goto("/dia/2095-05-10");
    const card = page.locator("#clip-PreviewClip0");
    await card.scrollIntoViewIfNeeded();
    const geometry = () =>
      page
        .locator(".catalog-card")
        .evaluateAll((nodes) =>
          nodes.map((n) => [
            (n as HTMLElement).offsetWidth,
            (n as HTMLElement).offsetHeight,
            (n as HTMLElement).offsetTop,
          ]),
        );
    const before = await geometry();
    await card.hover();
    await page.waitForTimeout(150);
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.mouse.move(1, 1);
    await page.waitForTimeout(750);
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.locator(".card-preview-layer")).toHaveCount(0);
    expect(await geometry()).toEqual(before);
  } finally {
    await closeContext(ctx);
  }
});
