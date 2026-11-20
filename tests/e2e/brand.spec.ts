import { test, expect } from "@playwright/test";

test("el logo se carga en cabecera y se anuncian favicon e imagen social", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const logo = page.locator("header .brand-logo");
  await expect(logo).toBeVisible();
  expect(
    await logo.evaluate((i: HTMLImageElement) => i.naturalWidth),
  ).toBeGreaterThan(0);
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute(
    "href",
    /\/brand\/icon-32\.png$/,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/brand\/og\.jpg$/,
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  for (const p of ["icon-32.png", "apple-touch-icon.png", "og.jpg"])
    expect((await request.get(`/brand/${p}`)).ok()).toBe(true);
});
