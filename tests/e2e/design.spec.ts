import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";

test("design: responsive discovery, sharing, filter recovery and screenshots", async ({
  browser,
  request,
}) => {
  const token = await readFile(".wrangler/e2e/editor-token", "utf8");
  const date = "2098-04-18";
  const result = await request.post("/admin/publish", {
    headers: {
      "Cf-Access-Jwt-Assertion": token,
      Origin: "http://127.0.0.1:8788",
    },
    data: {
      revision: 0,
      edition: {
        date,
        title: "The city never runs out of stories.",
        intro:
          "Six moments from the streets. Unexpected turns, close calls, and the creators who caught them.",
        hook: "Six moments",
        demo: true,
        reviewed: false,
        featured: "DesignClip0",
        clips: Array.from({ length: 6 }, (_, i) => ({
          url: `https://clips.twitch.tv/DesignClip${i}`,
          streamer: ["Alex", "Luna", "Kai"][i % 3],
          title: [
            "One corner. Zero room for error.",
            "The getaway nobody planned",
            "A different side of the city",
          ][i % 3],
          text: "A curated test moment with context and credit.",
          category: i % 2 ? "Jugadas" : "Detalles",
        })),
      },
    },
  });
  expect(result.status()).toBe(200);
  for (const width of [320, 390, 768, 1440]) {
    const ctx = await browser.newContext({
      viewport: { width, height: 1000 },
      isMobile: width < 768,
      hasTouch: width < 768,
      reducedMotion: "reduce",
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await ctx.newPage();
    await page.goto("/dia/" + date);
    await expect(page.locator("header .nav-selection")).toBeVisible();
    await expect(page.locator("header .nav-selection")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.locator("[data-share-edition]").click();
    await expect(page.locator(".share-status")).toHaveText(
      "Edition link copied.",
    );
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      "/dia/" + date,
    );
    await page.screenshot({
      path: test.info().outputPath(`design-${width}.png`),
      fullPage: true,
    });
    await page.locator("header .nav-search").click();
    await expect(page.locator("#clip-search")).toBeFocused();
    await page.locator("#clip-search").fill("not-present-anywhere");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "No clips match that selection." }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page.locator(".catalog-card")).toHaveCount(6);
    await ctx.close();
  }
});
