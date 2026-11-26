import { test, expect } from "@playwright/test";
import { seedCinema, providers } from "./cinema-helpers";
for (const width of [320, 390, 768, 1440])
  test(`central screen ${width}px: deliberate single-player switching and original fallback`, async ({
    browser,
    request,
  }) => {
    const date =
      "2093-01-" +
      (
        { 320: "01", 390: "02", 768: "03", 1440: "04" } as Record<
          number,
          string
        >
      )[width];
    await seedCinema(request, date);
    const ctx = await browser.newContext({
      viewport: { width, height: 1000 },
      hasTouch: width < 768,
      isMobile: width < 768,
      reducedMotion: "reduce",
    });
    await providers(ctx);
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.goto("/dia/" + date);
      await expect(page.locator("iframe")).toHaveCount(0);
      const screen = page.locator("[data-preview-hero]");
      await screen.locator("[data-preview-toggle]").click();
      await expect(screen).toHaveAttribute("data-playback", "playing");
      await expect(page.locator("iframe")).toHaveCount(1);
      const box = (await screen.locator("iframe").boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(200);
      expect(box.height).toBeGreaterThanOrEqual(200);
      await page.keyboard.press("Escape");
      await expect(page.locator("iframe")).toHaveCount(0);
      const x = page.locator('[id="clip-x:123"]');
      await x.hover();
      await page.waitForTimeout(700);
      await expect(page.locator("iframe")).toHaveCount(0);
      await x.locator(".clip-link").click();
      await expect(screen).toHaveAttribute("data-playback", "ready");
      await expect(page.locator("iframe")).toHaveCount(1);
      await expect(screen.locator(".preview-source")).toHaveAttribute(
        "href",
        "https://x.com/demo/status/123",
      );
      await page.locator('[id="clip-CinemaTwitch"] .clip-link').click();
      if (width < 420) {
        await expect(screen).toHaveAttribute("data-playback", "unavailable");
        await expect(page.locator("iframe")).toHaveCount(0);
      } else {
        await expect(screen).toHaveAttribute("data-playback", "ready");
        const b = (await screen.locator("iframe").boundingBox())!;
        expect(b.width).toBeGreaterThanOrEqual(400);
        expect(b.height).toBeGreaterThanOrEqual(300);
      }
      await page.locator('[id="clip-youtube:abcdefghijl"] .clip-link').click();
      await expect(screen).toHaveAttribute("data-playback", "playing");
      await expect(page.locator("iframe")).toHaveCount(1);
      await expect(screen.locator(".preview-stage")).toHaveAttribute(
        "data-orientation",
        "portrait",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: test.info().outputPath(`cinema-${width}.png`),
        fullPage: true,
      });
      await page.keyboard.press("Escape");
      await expect(page.locator("iframe")).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
test("provider error retains original; late script cannot resurrect cancelled media", async ({
  browser,
  request,
}) => {
  await seedCinema(request, "2093-02-01");
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await providers(ctx);
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await ctx.route("https://www.youtube.com/iframe_api", async (r) => {
    await held;
    await r
      .fulfill({
        contentType: "text/javascript",
        body: "window.YT={Player:class{}};window.onYouTubeIframeAPIReady();",
      })
      .catch(() => {});
  });
  const page = await ctx.newPage();
  try {
    await page.goto("/dia/2093-02-01");
    const screen = page.locator("[data-preview-hero]");
    await screen.locator("[data-preview-toggle]").click();
    await expect(screen).toHaveAttribute("data-playback", "loading");
    await page.keyboard.press("Escape");
    release();
    await page.waitForTimeout(300);
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(screen).toHaveAttribute("data-playback", "idle");
    await ctx.route("https://platform.twitter.com/widgets.js", (r) =>
      r.abort(),
    );
    await page.locator('[id="clip-x:123"] .clip-link').click();
    await expect(screen).toHaveAttribute("data-playback", "error");
    await expect(screen.locator(".preview-source")).toHaveAttribute(
      "href",
      "https://x.com/demo/status/123",
    );
    await expect(page.locator("iframe")).toHaveCount(0);
  } finally {
    release();
    await ctx.close();
  }
});
