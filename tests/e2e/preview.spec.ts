import { readFile } from "node:fs/promises";
import {
  test,
  expect,
  type Browser,
  type APIRequestContext,
  type BrowserContext,
} from "@playwright/test";

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
  await ctx.route("https://clips.twitch.tv/embed?**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<html><body style="margin:0;background:#162821;color:white"><p>Reproductor simulado de Twitch</p></body></html>',
    }),
  );
  return ctx;
}
async function assertFrame(ctx: BrowserContext, selector: string) {
  const frame = ctx.pages()[0].locator(selector + " iframe");
  await expect(frame).toHaveCount(1);
  const url = new URL((await frame.getAttribute("src"))!);
  expect(url.origin + url.pathname).toBe("https://clips.twitch.tv/embed");
  expect(url.searchParams.get("parent")).toBe("127.0.0.1");
  expect(url.searchParams.get("muted")).toBe("true");
  expect(url.searchParams.get("autoplay")).toBe("true");
  const box = (await frame.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(400);
  expect(box.height).toBeGreaterThanOrEqual(300);
  await expect(ctx.pages()[0].locator("iframe")).toHaveCount(1);
}

test("destacado automático, hover diferido, un solo reproductor y salida segura", async ({
  browser,
  request,
}) => {
  const date = "2095-05-06";
  await seed(request, date);
  const ctx = await context(browser);
  try {
    const page = await ctx.newPage();
    await page.goto("/dia/" + date);
    await assertFrame(ctx, ".hero-preview");
    await expect(
      page
        .frameLocator(".hero-preview iframe")
        .getByText("Reproductor simulado de Twitch"),
    ).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath("preview-desktop.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Detener vista previa" }).click();
    await expect(page.locator("iframe")).toHaveCount(0);
    const card = page.locator("#clip-PreviewClip0");
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await page.waitForTimeout(150);
    await expect(card.locator("iframe")).toHaveCount(0);
    await assertFrame(ctx, "#clip-PreviewClip0");
    await page.screenshot({
      path: test.info().outputPath("preview-hover.png"),
      fullPage: true,
    });
    await page.mouse.move(5, 5);
    await expect(page.locator("iframe")).toHaveCount(0);
    await card
      .getByRole("button", { name: "Vista previa", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await assertFrame(ctx, "#clip-PreviewClip0");
    await page.keyboard.press("Escape");
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.mouse.move(5, 5);
    await card
      .getByRole("button", { name: "Vista previa", exact: true })
      .click();
    await assertFrame(ctx, "#clip-PreviewClip0");
    await page.locator("#clips-rail").evaluate((el) => {
      (el as HTMLElement).style.scrollSnapType = "none";
      el.scrollLeft = 25;
    });
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.locator("#clips-rail").evaluate((el) => {
      el.scrollLeft = 0;
    });
    await card.locator("[data-preview-toggle]").click();
    await assertFrame(ctx, "#clip-PreviewClip0");
    await page.evaluate(() => {
      const stage = document
        .querySelector(".catalog-card.previewing .preview-stage")!
        .getBoundingClientRect();
      const header = document.querySelector("header")!.getBoundingClientRect();
      window.scrollBy(0, stage.top - header.bottom + 10);
    });
    await expect(page.locator("iframe")).toHaveCount(0);
    await card.scrollIntoViewIfNeeded();
    await page.mouse.move(5, 5);
    await card.locator("[data-preview-toggle]").click();
    await assertFrame(ctx, "#clip-PreviewClip0");
    await page.keyboard.press("Escape");
    const edgeCard = page.locator("#clip-PreviewClip4");
    await edgeCard.scrollIntoViewIfNeeded();
    await edgeCard.hover();
    await assertFrame(ctx, "#clip-PreviewClip4");
    const edgeBox = (await edgeCard.locator("iframe").boundingBox())!;
    const railBox = (await page.locator("#clips-rail").boundingBox())!;
    expect(edgeBox.x).toBeGreaterThanOrEqual(railBox.x);
    expect(edgeBox.x + edgeBox.width).toBeLessThanOrEqual(
      railBox.x + railBox.width,
    );
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(card.locator("[data-source]")).toHaveAttribute(
      "href",
      "https://clips.twitch.tv/PreviewClip0",
    );
  } finally {
    await ctx.close();
  }
});

test("movimiento reducido impide autoplay pero permite inicio manual", async ({
  browser,
  request,
}) => {
  const date = "2095-05-07";
  await seed(request, date);
  const ctx = await context(browser, { reducedMotion: "reduce" });
  try {
    const page = await ctx.newPage();
    await page.goto("/dia/" + date);
    await page.waitForTimeout(750);
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.locator(".hero-preview [data-preview-toggle]").click();
    await assertFrame(ctx, ".hero-preview");
    await page.locator("#seleccion").scrollIntoViewIfNeeded();
    await expect(page.locator("iframe")).toHaveCount(0);
    const card = page.locator("#clip-PreviewClip0");
    await card.hover();
    await page.waitForTimeout(750);
    await expect(page.locator("iframe")).toHaveCount(0);
    await card.locator("[data-preview-toggle]").click();
    await assertFrame(ctx, "#clip-PreviewClip0");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("iframe")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await ctx.close();
  }
});

test("móvil estrecho conserva la fuente y móvil amplio requiere toque; fallo conserva alternativa", async ({
  browser,
  request,
}) => {
  const date = "2095-05-08";
  await seed(request, date);
  const ctx = await context(browser, {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await ctx.newPage();
    await page.goto("/dia/" + date);
    await page.waitForTimeout(750);
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Reproducir en Twitch", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 768, height: 1100 });
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.locator(".hero-preview [data-preview-toggle]").tap();
    await assertFrame(ctx, ".hero-preview");
    await page.screenshot({
      path: test.info().outputPath("preview-touch.png"),
      fullPage: true,
    });
    await page.locator(".hero-preview [data-preview-toggle]").tap();
    const card = page.locator("#clip-PreviewClip0");
    await card.scrollIntoViewIfNeeded();
    const toggle = card.locator("[data-preview-toggle]");
    const offsetBefore = await toggle.evaluate(
      (el) =>
        el.getBoundingClientRect().top -
        el.closest("article")!.getBoundingClientRect().top,
    );
    await toggle.tap();
    await assertFrame(ctx, "#clip-PreviewClip0");
    const offsetAfter = await toggle.evaluate(
      (el) =>
        el.getBoundingClientRect().top -
        el.closest("article")!.getBoundingClientRect().top,
    );
    expect(offsetAfter).toBeCloseTo(offsetBefore, 0);
    await expect(
      page
        .frameLocator("#clip-PreviewClip0 iframe")
        .getByText("Reproductor simulado de Twitch"),
    ).toBeVisible();
    await expect(toggle).toHaveText("Detener vista previa");
    await expect(toggle).toBeInViewport();
    const stopButton = (await toggle.boundingBox())!;
    // Send the physical touch at the visible control. Locator.tap may scroll and
    // retry after the offscreen guard has already stopped and relabelled it.
    await page.touchscreen.tap(
      stopButton.x + stopButton.width / 2,
      stopButton.y + stopButton.height / 2,
    );
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.locator(".hero-preview").scrollIntoViewIfNeeded();
    await ctx.route("https://clips.twitch.tv/embed?**", (route) =>
      route.abort(),
    );
    await page.locator(".hero-preview [data-preview-toggle]").tap();
    await expect(page.locator(".hero-preview .preview-status")).toContainText(
      /original en Twitch/,
    );
    await expect(page.locator(".hero-preview .preview-source")).toHaveAttribute(
      "href",
      "https://clips.twitch.tv/PreviewClip0",
    );
  } finally {
    await ctx.close();
  }
});

test("ahorro de datos por sí solo desactiva destacado y hover automáticos", async ({
  browser,
  request,
}) => {
  const date = "2095-05-09";
  await seed(request, date);
  const ctx = await context(browser);
  try {
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "connection", {
        value: { saveData: true, addEventListener() {} },
      });
    });
    await page.goto("/dia/" + date);
    await page.waitForTimeout(750);
    await expect(page.locator("iframe")).toHaveCount(0);
    const card = page.locator("#clip-PreviewClip0");
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await page.waitForTimeout(750);
    await expect(page.locator("iframe")).toHaveCount(0);
    await card.locator("[data-preview-toggle]").click();
    await assertFrame(ctx, "#clip-PreviewClip0");
  } finally {
    await ctx.close();
  }
});
