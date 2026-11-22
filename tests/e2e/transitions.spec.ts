import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";

test("filter changes run a view transition, unless motion is reduced", async ({
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
    await page.addInitScript(() =>
      addEventListener("pagereveal", (e: any) =>
        sessionStorage.setItem("vt", e.viewTransition ? "yes" : "no"),
      ),
    );
    await page.goto("/dia/" + date);
    await expect(page.locator(".catalog-card")).toHaveCount(6);
    await page.evaluate(() => sessionStorage.removeItem("vt"));
    await page.locator(".filters a", { hasText: "Plays" }).click();
    await expect(page.locator(".catalog-card")).toHaveCount(3);
    await expect(page.locator(".filters a[aria-current]")).toHaveText("Plays");
    // pagereveal can fire after the new DOM is already visible, so poll.
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem("vt")))
      .toBe(reducedMotion === "reduce" ? "no" : "yes");
    await ctx.close();
  }
});
