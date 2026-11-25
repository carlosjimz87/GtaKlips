import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";

test("filter changes reorganise cards in place, with history, with or without motion", async ({
  browser,
  request,
}) => {
  const token = await readFile(".wrangler/e2e/editor-token", "utf8");
  const date = "2098-04-19";
  const result = await request.post("/admin/publish", {
    headers: {
      "Cf-Access-Jwt-Assertion": token,
      Origin: "http://127.0.0.1:8788",
    },
    data: {
      revision: 0,
      edition: {
        date,
        title: "Filters that glide.",
        intro: "Six moments to test filter transitions.",
        hook: "Six moments",
        demo: true,
        reviewed: false,
        featured: "FadeClip0",
        clips: Array.from({ length: 6 }, (_, i) => ({
          url: `https://clips.twitch.tv/FadeClip${i}`,
          streamer: ["Alex", "Luna", "Kai"][i % 3],
          title: `Fade clip ${i}`,
          text: "A curated test moment with context and credit.",
          category: i % 2 ? "Jugadas" : "Detalles",
        })),
      },
    },
  });
  expect(result.status()).toBe(200);
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion,
    });
    const page = await ctx.newPage();
    await page.goto("/dia/" + date);
    const visible = page.locator(".catalog-card:not([hidden])");
    await expect(visible).toHaveCount(6);
    await page.evaluate(() => ((window as any).sameDocument = true));
    await page.locator(".filters a", { hasText: "Plays" }).click();
    await expect(visible).toHaveCount(3);
    await expect(page.locator(".filters a[aria-current]")).toHaveText("Plays");
    await expect(page).toHaveURL(/categoria=Jugadas/);
    // Filtering reorganises the same document: no reload, no navigation.
    expect(await page.evaluate(() => (window as any).sameDocument)).toBe(true);
    await page.goBack();
    await expect(visible).toHaveCount(6);
    expect(await page.evaluate(() => (window as any).sameDocument)).toBe(true);
    await ctx.close();
  }
});
