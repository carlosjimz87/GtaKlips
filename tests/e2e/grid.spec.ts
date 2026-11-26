import { readFile } from "node:fs/promises";
import {
  test,
  expect,
  type APIRequestContext,
  type Browser,
} from "@playwright/test";

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
const open = (
  browser: Browser,
  reducedMotion: "reduce" | "no-preference",
  width = 1440,
) =>
  browser.newContext({
    viewport: { width, height: 1200 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
    reducedMotion,
  });

test("10 clips become 3 rows (4/3/3) with identical card sizes", async ({
  browser,
  request,
}) => {
  await seed(request, "2096-01-01", 10);
  const ctx = await open(browser, "reduce");
  const page = await ctx.newPage();
  await page.goto("/dia/2096-01-01");
  await expect(page.locator("[data-rail-row]")).toHaveCount(3);
  await expect(page.locator("#clips-rail .catalog-card")).toHaveCount(4);
  await expect(page.locator("#clips-rail-2 .catalog-card")).toHaveCount(3);
  await expect(page.locator("#clips-rail-3 .catalog-card")).toHaveCount(3);
  const sizes = await page.locator(".catalog-card").evaluateAll((cards) =>
    cards.map((c) => {
      const r = c.getBoundingClientRect();
      return `${Math.round(r.width)}x${Math.round(r.height)}`;
    }),
  );
  expect(new Set(sizes).size).toBe(1);
  // Collapsed text: titles and context never exceed two lines.
  const clamped = await page
    .locator(".catalog-card h2, .catalog-card .clip-caption")
    .evaluateAll((els) =>
      els.every((e) => {
        const lh = parseFloat(getComputedStyle(e).lineHeight);
        return e.getBoundingClientRect().height <= lh * 2 + 1;
      }),
    );
  expect(clamped).toBe(true);
  await expect(
    page.locator(".catalog-card .creator strong").first(),
  ).toHaveText("Anonymous");
  await expect(page.locator(".catalog-card .creator strong").nth(1)).toHaveText(
    "Video of Streamer number 1",
  );
  // The old overlay button is no longer visible on desktop.
  await expect(
    page.locator(".catalog-card [data-preview-toggle]").first(),
  ).not.toBeInViewport({ ratio: 0.5 });
  await page.locator("#seleccion").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: test.info().outputPath("grid-3-rows.png"),
    fullPage: false,
  });
  await ctx.close();
});

test("rows never auto-scroll and pointer devices get visible arrows", async ({
  browser,
  request,
}) => {
  await seed(request, "2096-01-02", 10);
  const ctx = await open(browser, "no-preference", 800);
  const page = await ctx.newPage();
  await page.goto("/dia/2096-01-02");
  const rail = page.locator("#clips-rail");
  await rail.scrollIntoViewIfNeeded();
  const left = () => rail.evaluate((el) => el.scrollLeft);
  // No idle swing and no edge-hover scrolling.
  await page.waitForTimeout(6500);
  expect(await left()).toBe(0);
  const box = (await rail.boundingBox())!;
  await page.mouse.move(box.x + box.width - 20, box.y + 40);
  await page.waitForTimeout(500);
  expect(await left()).toBe(0);
  // Visible arrow scrolls the row on click.
  const next = page.getByRole("button", { name: "Next clips (row 1 of 3)" });
  await expect(next).toBeVisible();
  await next.click();
  await expect.poll(left, { timeout: 5000 }).toBeGreaterThan(100);
  const prev = page.getByRole("button", {
    name: "Previous clips (row 1 of 3)",
  });
  await expect(prev).toBeVisible();
  await prev.click();
  await expect.poll(left, { timeout: 5000 }).toBeLessThan(2);
  await ctx.close();
});
