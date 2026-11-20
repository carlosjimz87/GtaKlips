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
      body: '<html><body style="margin:0;background:#162821;color:white"><p>Reproductor simulado de Twitch</p><button onclick="document.documentElement.requestFullscreen()">Pantalla completa</button></body></html>',
    }),
  );
  return ctx;
}
async function assertFrame(ctx: BrowserContext, selector: string) {
  const frame = ctx
    .pages()[0]
    .locator(
      selector === ".hero-preview"
        ? selector + " iframe"
        : `.card-preview-layer[data-preview-owner="${selector.slice(1)}"] iframe`,
    );
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
    await page.getByRole("button", { name: "Stop preview" }).click();
    await expect(page.locator("iframe")).toHaveCount(0);
    const card = page.locator("#clip-PreviewClip0");
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await page.waitForTimeout(150);
    await expect(page.locator(".card-preview-layer")).toHaveCount(0);
    await assertFrame(ctx, "#clip-PreviewClip0");
    await page.screenshot({
      path: test.info().outputPath("preview-hover.png"),
      fullPage: false,
    });
    await page.locator(".card-preview-layer iframe").hover();
    await page
      .frameLocator(".card-preview-layer iframe")
      .getByText("Reproductor simulado de Twitch")
      .click();
    // Remain inside the player beyond the pointer handoff grace period.
    await page.waitForTimeout(180);
    await expect(page.locator(".card-preview-layer iframe")).toHaveCount(1);
    // A neighbouring card must not cancel the previous owner's close timer.
    const second = (await page.locator("#clip-PreviewClip1").boundingBox())!;
    await page.mouse.move(second.x + second.width - 20, second.y + 24);
    await assertFrame(ctx, "#clip-PreviewClip1");
    const third = (await page.locator("#clip-PreviewClip2").boundingBox())!;
    await page.mouse.move(third.x + third.width - 20, third.y + 24);
    await page.mouse.move(5, 5);
    await expect(page.locator("iframe")).toHaveCount(0);
    // Crossing the next card briefly must not open a delayed replacement.
    await page.waitForTimeout(600);
    await expect(page.locator("iframe")).toHaveCount(0);
    await card.getByRole("button", { name: "Preview", exact: true }).focus();
    await page.keyboard.press("Enter");
    await assertFrame(ctx, "#clip-PreviewClip0");
    await page.keyboard.press("Escape");
    await expect(page.locator("iframe")).toHaveCount(0);
    await page.mouse.move(5, 5);
    await card.getByRole("button", { name: "Preview", exact: true }).click();
    await assertFrame(ctx, "#clip-PreviewClip0");
    await page.locator(".card-preview-layer .layer-footer a").focus();
    await page.keyboard.press("Tab");
    await expect(
      page.locator("#clip-PreviewClip1 [data-source]"),
    ).toBeFocused();
    await expect(page.locator("iframe")).toHaveCount(0);
    await card.locator("[data-preview-toggle]").focus();
    await page.keyboard.press("Enter");
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
        .querySelector(".card-preview-layer .preview-stage")!
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
    const edgeBox = (await page
      .locator(".card-preview-layer iframe")
      .boundingBox())!;
    const viewportWidth = await page.evaluate(
      () => document.documentElement.clientWidth,
    );
    const headerBottom = await page
      .locator("header")
      .evaluate((el) => el.getBoundingClientRect().bottom);
    expect(edgeBox.x).toBeGreaterThanOrEqual(12);
    expect(edgeBox.x + edgeBox.width).toBeLessThanOrEqual(viewportWidth - 12);
    expect(edgeBox.y).toBeGreaterThan(headerBottom);
    await page
      .frameLocator(".card-preview-layer iframe")
      .getByRole("button", { name: "Pantalla completa" })
      .click();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement?.tagName))
      .toBe("IFRAME");
    await page.evaluate(() => {
      dispatchEvent(new Event("resize"));
      dispatchEvent(new Event("scroll"));
    });
    await expect(page.locator(".card-preview-layer iframe")).toHaveCount(1);
    await page.evaluate(() => document.exitFullscreen());
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await expect(page.locator(".card-preview-layer iframe")).toHaveCount(1);
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
    await closeContext(ctx);
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
    await closeContext(ctx);
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
      page.getByRole("link", { name: "Play on Twitch", exact: true }),
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
        .frameLocator(
          '.card-preview-layer[data-preview-owner="clip-PreviewClip0"] iframe',
        )
        .getByText("Reproductor simulado de Twitch"),
    ).toBeVisible();
    await expect(toggle).toHaveText("Stop preview");
    const close = page.getByRole("button", {
      name: "Close preview",
      exact: true,
    });
    await expect(close).toBeFocused();
    await expect(close).toBeInViewport();
    const stopButton = (await close.boundingBox())!;
    // Send a physical touch to the visible floating control without driver scroll.
    await page.touchscreen.tap(
      stopButton.x + stopButton.width / 2,
      stopButton.y + stopButton.height / 2,
    );
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(toggle).toBeFocused();
    await page.locator(".hero-preview").scrollIntoViewIfNeeded();
    await ctx.route("https://clips.twitch.tv/embed?**", (route) =>
      route.abort(),
    );
    await page.locator(".hero-preview [data-preview-toggle]").tap();
    await expect(page.locator(".hero-preview .preview-status")).toContainText(
      /original on Twitch/,
    );
    await expect(page.locator(".hero-preview .preview-source")).toHaveAttribute(
      "href",
      "https://clips.twitch.tv/PreviewClip0",
    );
  } finally {
    await closeContext(ctx);
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
    await closeContext(ctx);
  }
});

test("preview flotante: animación antes del vídeo, geometría intacta y cancelación sin iframe tardío", async ({
  browser,
  request,
}) => {
  const date = "2095-05-10";
  await seed(request, date);
  const ctx = await context(browser);
  try {
    await ctx.addInitScript(() => {
      const animate = Element.prototype.animate;
      (window as any).heldPreviewAnimations = [];
      Element.prototype.animate = function (
        ...args: Parameters<Element["animate"]>
      ) {
        const result = animate.apply(this, args);
        if (
          this.classList.contains("card-preview-layer") &&
          this.getAttribute("data-phase") === "opening"
        ) {
          result.pause();
          (window as any).heldPreviewAnimations.push(result);
        }
        return result;
      };
    });
    const page = await ctx.newPage();
    await page.goto("/dia/" + date + "#seleccion");
    await expect(page.locator("iframe")).toHaveCount(0);
    const card = page.locator("#clip-PreviewClip0");
    await card.scrollIntoViewIfNeeded();
    const geometry = () =>
      page.evaluate(() => ({
        cards: Array.from(document.querySelectorAll(".catalog-card")).map(
          (el) => {
            const { x, y, width, height } = el.getBoundingClientRect();
            return { x, y, width, height };
          },
        ),
        rail: document.getElementById("clips-rail")!.scrollLeft,
        railWidth: document.getElementById("clips-rail")!.scrollWidth,
        railHeight: document.getElementById("clips-rail")!.clientHeight,
        pageY: scrollY,
        genre: document.querySelector(".genre-section")!.getBoundingClientRect()
          .top,
        footer: document.querySelector("footer")!.getBoundingClientRect().top,
        height: document.documentElement.scrollHeight,
      }));
    const before = await geometry();
    await card.hover();
    const layer = page.locator(".card-preview-layer");
    await expect(layer).toHaveAttribute("data-phase", "opening");
    await expect(page.locator("iframe")).toHaveCount(0);
    expect(await geometry()).toEqual(before);
    await page.evaluate(() =>
      (window as any).heldPreviewAnimations[0].finish(),
    );
    await assertFrame(ctx, "#clip-PreviewClip0");
    await expect(layer).toHaveAttribute("data-phase", "ready");
    expect(await geometry()).toEqual(before);
    await page.mouse.move(5, 5);
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(layer).toHaveCount(0);
    expect(await geometry()).toEqual(before);
    await card.hover();
    await expect(layer).toHaveAttribute("data-phase", "opening");
    await page.keyboard.press("Escape");
    await expect(layer).toHaveCount(0);
    // Even restarting a previously cancelled animation cannot mount stale media.
    await page.evaluate(() => {
      const animation = (window as any).heldPreviewAnimations[1];
      animation.play();
      animation.finish();
    });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await expect(page.locator("iframe")).toHaveCount(0);
    expect(await geometry()).toEqual(before);
  } finally {
    await closeContext(ctx);
  }
});
