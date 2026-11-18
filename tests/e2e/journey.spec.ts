import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
test("recorrido móvil: borrador privado, ordenar, destacar, publicar y copiar", async ({
  page,
  browser,
  context,
}) => {
  const token = await readFile(".wrangler/e2e/editor-token", "utf8");
  await page.route("**/admin**", (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        "Cf-Access-Jwt-Assertion": token,
      },
    }),
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const date = `20${String(30 + Math.floor(Math.random() * 60))}-11-${String(1 + Math.floor(Math.random() * 27)).padStart(2, "0")}`;
  await page.goto("/admin");
  await page.getByLabel("Fecha editorial").fill(date);
  await page
    .getByLabel("Título de la edición")
    .fill("Cinco momentos · edición de demostración");
  await page
    .getByLabel("Entradilla")
    .fill("Selección de prueba: las fuentes no están verificadas.");
  await page
    .getByLabel("Gancho aprobado")
    .fill("Un recorrido de demostración, sin metraje verificado.");
  for (let i = 0; i < 5; i++) {
    if (i) await page.getByRole("button", { name: "Añadir clip" }).click();
    const clip = page.locator(".clip-input").nth(i);
    await clip
      .getByLabel("URL del clip")
      .fill(`https://clips.twitch.tv/DemoJourney${i}`);
    await clip.getByLabel("Streamer").fill(`Creador demo ${i}`);
    await clip.getByLabel("Título del clip").fill(`Momento demo ${i}`);
    await clip
      .getByLabel("Contexto editorial")
      .fill(`Contexto de prueba ${i}, no verificado.`);
    await clip
      .getByLabel("Categoría")
      .selectOption(i === 1 ? "Jugadas" : "Fails");
  }
  await page
    .locator(".clip-input")
    .nth(4)
    .getByLabel("Destacado de la edición")
    .check();
  await page
    .locator(".clip-input")
    .nth(4)
    .getByRole("button", { name: "Subir", exact: true })
    .click();
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByRole("status")).toContainText("Borrador guardado");
  const anon = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const publicPage = await anon.newPage();
  expect((await anon.request.get("/admin")).status()).toBe(401);
  expect(
    (await anon.request.post("/admin/publish", { data: {} })).status(),
  ).toBe(401);
  const draft = await publicPage.goto(`/dia/${date}`);
  expect(draft?.status()).toBe(404);
  expect(await (await anon.request.get("/sitemap.xml")).text()).not.toContain(
    `/dia/${date}`,
  );
  expect(await (await anon.request.get("/archivo")).text()).not.toContain(
    `/dia/${date}`,
  );
  await page.goto(`/admin?date=${date}`);
  await expect(page.locator(".clip-input")).toHaveCount(5);
  await expect(
    page.locator(".clip-input").nth(3).getByLabel("Título del clip"),
  ).toHaveValue("Momento demo 4");
  await page.getByRole("button", { name: "Publicar edición" }).click();
  await expect(page.getByRole("status")).toContainText("Edición publicada");
  await page.getByRole("button", { name: "Copiar post" }).click();
  await expect(page.getByRole("status")).toContainText("Post copiado");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("5 clips");
  expect(copied).toContain("DEMOSTRACIÓN");
  const link = copied.split("\n").at(-1)!;
  expect(link).toContain("utm_source=x");
  expect(link).toContain("#clip-DemoJourney4");
  await publicPage.goto(link);
  await expect(publicPage.locator(":target")).toHaveAttribute(
    "id",
    "clip-DemoJourney4",
  );
  await expect(publicPage.locator(":target")).toHaveClass(/featured/);
  await expect(publicPage.locator("article")).toHaveCount(5);
  await expect(
    publicPage.getByText("DEMOSTRACIÓN · Datos de prueba", { exact: false }),
  ).toBeVisible();
  await expect(publicPage.locator("article").nth(3)).toHaveAttribute(
    "id",
    "clip-DemoJourney4",
  );
  await expect(publicPage.locator("link[rel=canonical]")).toHaveAttribute(
    "href",
    `http://127.0.0.1:8787/dia/${date}`,
  );
  for (const a of await publicPage.locator("article a").all())
    expect(await a.getAttribute("href")).toMatch(
      /^https:\/\/clips.twitch.tv\/DemoJourney/,
    );
  await publicPage.screenshot({
    path: "test-results/mobile-public.png",
    fullPage: true,
  });
  expect(
    await publicPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await publicPage.screenshot({
    path: test.info().outputPath("public-mobile.png"),
    fullPage: true,
  });
  await page.screenshot({
    path: test.info().outputPath("admin-mobile.png"),
    fullPage: true,
  });
  await publicPage.getByRole("link", { name: "Jugadas", exact: true }).click();
  await expect(publicPage.locator("article")).toHaveCount(1);
  await page.getByLabel("Título de la edición").fill("CAMBIO PRIVADO");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByRole("status")).toContainText("Borrador guardado");
  await publicPage.goto(link);
  await expect(publicPage.locator("h1")).not.toContainText("CAMBIO PRIVADO");
  await page.getByLabel("ID del clip", { exact: true }).fill("DemoJourney4");
  await page.getByRole("button", { name: "Retirar clip", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Clip retirado");
  await publicPage.reload();
  await expect(publicPage.locator("article")).toHaveCount(4);
  await expect(publicPage.locator(".featured")).toHaveAttribute(
    "id",
    "clip-DemoJourney0",
  );
  await anon.close();
});

test("controles de escritura y XSS en el navegador móvil", async ({
  page,
  request,
}) => {
  const token = await readFile(".wrangler/e2e/editor-token", "utf8");
  const auth = { "Cf-Access-Jwt-Assertion": token };
  const edition = {
    date: "2099-10-01",
    title: "<img src=x onerror=alert(1)>",
    intro: "<script>alert(1)</script>",
    hook: "Demo segura",
    demo: true,
    reviewed: false,
    featured: "SecurityDemo",
    clips: [
      {
        url: "https://clips.twitch.tv/SecurityDemo",
        title: "<svg onload=alert(1)>",
        streamer: "<img src=x>",
        text: "<script>alert(1)</script>",
        category: "Detalles",
      },
    ],
  };
  const saved = await request.get("/admin/data?date=" + edition.date, {
    headers: auth,
  });
  const revision = saved.ok() ? (await saved.json()).revision : 0;
  for (const origin of ["https://evil.example", "null"]) {
    const r = await request.post("/admin/publish", {
      headers: { ...auth, Origin: origin },
      data: { edition, revision },
    });
    expect(r.status()).toBe(403);
  }
  const invalid = await request.post("/admin/save", {
    headers: { ...auth, Origin: "http://127.0.0.1:8787" },
    data: {
      edition: {
        ...edition,
        clips: [{ ...edition.clips[0], url: "https://evil.example/video" }],
      },
      revision,
    },
  });
  expect(invalid.status()).toBe(400);
  const published = await request.post("/admin/publish", {
    headers: { ...auth, Origin: "http://127.0.0.1:8787" },
    data: { edition, revision },
  });
  expect(published.status()).toBe(200);
  let dialog = false;
  page.on("dialog", async (d) => {
    dialog = true;
    await d.dismiss();
  });
  await page.goto("/dia/" + edition.date);
  await expect(page.locator("h1")).toHaveText(edition.title);
  await expect(page.locator("main script, main img, main svg")).toHaveCount(0);
  expect(dialog).toBe(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
