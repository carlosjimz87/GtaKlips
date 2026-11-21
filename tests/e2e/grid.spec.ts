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

test("hovering the row edge scrolls it; idle rows swing and return", async ({
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
  // Idle swing: starts without any interaction after ~5 s, then returns.
  await expect.poll(left, { timeout: 12000 }).toBeGreaterThan(40);
  await expect.poll(left, { timeout: 15000 }).toBeLessThan(2);
  // Edge zone: mouse near the right edge scrolls the row.
  const box = (await page.locator("#clips-rail").boundingBox())!;
  await page.mouse.move(box.x + box.width - 20, box.y + 40);
  await expect.poll(left, { timeout: 5000 }).toBeGreaterThan(200);
  await page.mouse.move(box.x + box.width / 2, box.y - 60);
  const rest = await left();
  await page.waitForTimeout(300);
  expect(Math.abs((await left()) - rest)).toBeLessThan(30);
  // Hidden but present controls keep working for keyboard users.
  await page
    .getByRole("button", { name: "Previous clips (row 1 of 3)" })
    .dispatchEvent("click");
  await expect.poll(left, { timeout: 5000 }).toBeLessThan(rest);
  await ctx.close();
});

test("prefers-reduced-motion disables the idle swing", async ({
  browser,
  request,
}) => {
  await seed(request, "2096-01-03", 10);
  const ctx = await open(browser, "reduce", 800);
  const page = await ctx.newPage();
  await page.goto("/dia/2096-01-03");
  await page.locator("#clips-rail").scrollIntoViewIfNeeded();
  await page.waitForTimeout(7500);
  expect(
    await page.locator("#clips-rail").evaluate((el) => el.scrollLeft),
  ).toBe(0);
  await ctx.close();
});

test("switching reduced motion on stops active edge scrolling", async ({
  browser,
  request,
}) => {
  await seed(request, "2096-01-04", 10);
  const ctx = await open(browser, "no-preference", 800);
  const page = await ctx.newPage();
  await page.goto("/dia/2096-01-04");
  const rail = page.locator("#clips-rail");
  await rail.scrollIntoViewIfNeeded();
  const edge = page
    .locator("[data-rail-row]")
    .first()
    .locator('[data-edge="1"]');
  await edge.dispatchEvent("pointerenter", { pointerType: "mouse" });
  await expect
    .poll(() => rail.evaluate((e) => e.scrollLeft))
    .toBeGreaterThan(10);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(100);
  const position = await rail.evaluate((e) => e.scrollLeft);
  await page.waitForTimeout(350);
  expect(await rail.evaluate((e) => e.scrollLeft)).toBe(position);
  await ctx.close();
});
