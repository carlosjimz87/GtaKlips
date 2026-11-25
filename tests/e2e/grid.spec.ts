import { readFile } from "node:fs/promises";
import { test, expect, type APIRequestContext } from "@playwright/test";

async function seed(request: APIRequestContext, date: string, count: number) {
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
        title: "Grid redesign",
        intro: "Rows of equally sized cards.",
        hook: "Grid",
        demo: true,
        reviewed: false,
        featured: "GridClip0",
        clips: Array.from({ length: count }, (_, i) => ({
          url: `https://clips.twitch.tv/GridClip${i}`,
          streamer: i % 3 === 0 ? "" : `Streamer number ${i}`,
          creator: i % 3 === 0 ? "" : undefined,
          title:
            i % 2
              ? `A very long clip title that must be collapsed to two lines number ${i}`
              : `Clip ${i}`,
          text: "Long context ".repeat(i % 2 ? 30 : 1),
          category: "Jugadas",
        })),
      },
    },
  });
  expect(result.status()).toBe(200);
}
for (const count of [1, 2, 5, 7, 10])
  test(`${count} clips: fluid grid, identical cards, no overflow, no orphan gaps`, async ({
    browser,
    request,
  }) => {
    const date = `2096-0${1 + [1, 2, 5, 7, 10].indexOf(count)}-01`;
    await seed(request, date, count);
    for (const width of [320, 768, 1440]) {
      const ctx = await browser.newContext({
        viewport: { width, height: 1000 },
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
      });
      try {
        const page = await ctx.newPage();
        await page.goto("/dia/" + date);
        const cards = page.locator(".catalog-card:not([hidden])");
        await expect(cards).toHaveCount(count);
        const boxes = await cards.evaluateAll((els) =>
          els.map((el) => {
            const b = el.getBoundingClientRect();
            const poster = el.querySelector(".poster")!.getBoundingClientRect();
            return {
              x: Math.round(b.x),
              w: Math.round(b.width),
              pw: Math.round(poster.width),
              ph: Math.round(poster.height),
              top: Math.round(b.top + scrollY),
            };
          }),
        );
        // Every poster has the same 16:9 geometry, whatever the title length.
        for (const b of boxes) {
          expect(Math.abs(b.pw - boxes[0].pw)).toBeLessThanOrEqual(1);
          expect(
            Math.abs(b.ph - Math.round((b.pw * 9) / 16)),
          ).toBeLessThanOrEqual(2);
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.x + b.w).toBeLessThanOrEqual(width + 1);
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        // Cards never scroll sideways: no rail container with horizontal overflow.
        expect(
          await page
            .locator(".catalog-grid")
            .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        ).toBe(true);
      } finally {
        await ctx.close();
      }
    }
  });
