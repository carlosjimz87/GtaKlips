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
    `http://127.0.0.1:8788/dia/${date}`,
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
    headers: { ...auth, Origin: "http://127.0.0.1:8788" },
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
    headers: { ...auth, Origin: "http://127.0.0.1:8788" },
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

test("importación móvil: fallo seguro, reintento, revisión privada y publicación editorial explícita", async ({
  page,
  browser,
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
  const anon = await browser.newContext();
  try {
    expect((await anon.request.get("/admin/imports")).status()).toBe(401);
    expect(
      (await anon.request.post("/admin/import", { data: {} })).status(),
    ).toBe(401);
    await page.goto("/admin");
    await page
      .getByRole("link", { name: "Importaciones y candidatos" })
      .click();
    await page.getByRole("button", { name: "Importar / reintentar" }).click();
    await expect(
      page.getByText("Límite de Twitch alcanzado", { exact: false }),
    ).toBeVisible();
    await expect(page.locator(".candidate")).toHaveCount(0);
    await page.getByRole("button", { name: "Importar / reintentar" }).click();
    await expect(page.locator(".candidate")).toHaveCount(1);
    await expect(
      page
        .locator(".import-run")
        .first()
        .getByText("Categoría confirmada en esta ejecución", { exact: false }),
    ).toBeVisible();
    await expect(page.locator(".candidate h3")).toHaveText(
      "Fuente <img src=x> de prueba",
    );
    await expect(page.locator("main img, main svg")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Rechazar", exact: true }).click();
    await expect(page.locator(".candidate strong")).toHaveText("rejected");
    await page
      .getByRole("button", { name: "Seleccionar", exact: true })
      .click();
    await expect(page.locator(".candidate strong")).toHaveText("selected");
    await page.getByRole("button", { name: "Importar / reintentar" }).click();
    await expect(page.locator(".candidate strong")).toHaveText("selected");
    await expect(page.locator(".candidate")).toHaveCount(1);
    await expect(page.locator(".candidate")).toContainText(
      "30 vistas observadas",
    );
    for (const path of ["/", "/archivo", "/sitemap.xml"])
      expect(await (await anon.request.get(path)).text()).not.toContain(
        "ImportedJourney",
      );
    await page.screenshot({
      path: test.info().outputPath("import-mobile.png"),
      fullPage: true,
    });
    await page.getByRole("link", { name: "Usar en editor" }).click();
    await expect(page.getByLabel("URL del clip")).toHaveValue(
      "https://clips.twitch.tv/ImportedJourney",
    );
    await expect(page.getByLabel("Contexto editorial")).toHaveValue("");
    await page.getByLabel("Fecha editorial").fill("2098-01-02");
    await page
      .getByLabel("Título de la edición")
      .fill("Importación demo con revisión manual");
    await page
      .getByLabel("Entradilla")
      .fill("Fixture de importación: no es metraje verificado.");
    await page.getByLabel("Gancho aprobado").fill("Prueba editorial manual.");
    await page.getByLabel("Destacado de la edición").check();
    await page.getByRole("button", { name: "Publicar edición" }).click();
    expect((await anon.request.get("/dia/2098-01-02")).status()).toBe(404);
    await page
      .getByLabel("Contexto editorial")
      .fill("Contexto original de demostración escrito por el operador.");
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByRole("status")).toContainText("Borrador guardado");
    expect((await anon.request.get("/dia/2098-01-02")).status()).toBe(404);
    await page.getByRole("button", { name: "Publicar edición" }).click();
    await expect(page.getByRole("status")).toContainText("Edición publicada");
    const published = await anon.request.get("/dia/2098-01-02");
    expect(published.status()).toBe(200);
    expect(await published.text()).toContain(
      "Contexto original de demostración escrito por el operador.",
    );
  } finally {
    await anon.close();
  }
});

test("catálogo visual: miniaturas, reproducción, búsqueda y navegación en móvil y escritorio", async ({
  page,
  browser,
  request,
}) => {
  const token = await readFile(".wrangler/e2e/editor-token", "utf8");
  const edition = {
    date: "2097-04-05",
    title: "Una ciudad. Mil momentos.",
    intro: "Catálogo de demostración para probar la selección.",
    hook: "Cinco momentos de prueba",
    demo: true,
    reviewed: false,
    featured: "CatalogBrowser2",
    clips: Array.from({ length: 5 }, (_, i) => ({
      url: `https://clips.twitch.tv/CatalogBrowser${i}`,
      streamer: `Creador catálogo ${i}`,
      title: `Momento de catálogo ${i}`,
      text: "Contexto editorial de prueba.",
      category: i === 2 ? "Jugadas" : "Detalles",
      thumbnail: `https://static-cdn.jtvnw.net/fixture/catalog-${i}.jpg`,
      duration: 35 + i,
    })),
  };
  const saved = await request.post("/admin/publish", {
    headers: {
      "Cf-Access-Jwt-Assertion": token,
      Origin: "http://127.0.0.1:8788",
    },
    data: { edition, revision: 0 },
  });
  expect(saved.status()).toBe(200);
  const mockPosters = async (route: import("@playwright/test").Route) => {
    if (route.request().url().endsWith("catalog-4.jpg")) return route.abort();
    return route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><defs><linearGradient id="g"><stop stop-color="#284943"/><stop offset="1" stop-color="#182230"/></linearGradient></defs><rect width="960" height="540" fill="url(#g)"/><path d="M0 420L160 280 320 390 550 170 780 300 960 230V540H0Z" fill="#425452"/></svg>',
    });
  };
  await page.route("https://static-cdn.jtvnw.net/fixture/**", mockPosters);
  await page.goto("/dia/" + edition.date);
  await page
    .locator("header")
    .getByRole("link", { name: "Buscar", exact: true })
    .click();
  await expect(page.getByLabel("Encuentra un clip o un creador")).toBeFocused();
  await expect(
    page.getByLabel("Encuentra un clip o un creador"),
  ).toBeInViewport();
  await page.goto("/dia/" + edition.date);
  await expect(page.locator(".catalog-card")).toHaveCount(5);
  await expect(page.locator(".billboard h1")).toHaveText(edition.title);
  await expect(
    page.locator(".billboard .featured-credit:visible"),
  ).toContainText("Creador catálogo 2");
  await expect(
    page.getByRole("link", { name: "Reproducir en Twitch", exact: true }),
  ).toHaveAttribute("href", "https://clips.twitch.tv/CatalogBrowser2");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Clips siguientes" }).click();
  await expect
    .poll(() => page.locator("#clips-rail").evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
  const missingPoster = page.locator("#clip-CatalogBrowser4 img[data-poster]");
  await page.locator("#clip-CatalogBrowser4").scrollIntoViewIfNeeded();
  await expect(missingPoster).toBeHidden();
  await expect(page.locator("#clip-CatalogBrowser4 .source")).toHaveText(
    /Ver en Twitch/,
  );
  await page.goto(
    "/dia/" + edition.date + "?utm_source=x#clip-CatalogBrowser2",
  );
  await expect(page.locator(":target")).toHaveAttribute(
    "id",
    "clip-CatalogBrowser2",
  );
  await expect(page.locator(":target")).toHaveClass(/featured/);
  await expect(page.locator(":target")).toBeInViewport();
  await page
    .getByLabel("Encuentra un clip o un creador")
    .fill("Creador catálogo 2");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.locator(".catalog-card")).toHaveCount(1);
  await expect(page.locator(".catalog-card")).toHaveAttribute(
    "id",
    "clip-CatalogBrowser2",
  );
  await page.goto("/dia/" + edition.date);
  await page.screenshot({
    path: test.info().outputPath("catalog-mobile.png"),
    fullPage: true,
  });
  for (const [width, height] of [
    [320, 740],
    [768, 1100],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/dia/" + edition.date);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.locator(".billboard .featured-credit:visible"),
    ).toContainText("Creador catálogo 2");
    expect(
      await page
        .locator(".genre-card strong")
        .evaluateAll((labels) =>
          labels.every((el) => el.scrollWidth <= el.clientWidth + 1),
        ),
    ).toBe(true);
    await expect(
      page
        .locator("header")
        .getByRole("link", { name: "Archivo", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator("footer")
        .getByRole("link", { name: "Ediciones anteriores" }),
    ).toHaveAttribute("href", "/archivo");
    await page.screenshot({
      path: test.info().outputPath(`editorial-${width}.png`),
      fullPage: true,
    });
  }
  await page
    .locator("footer")
    .getByRole("link", { name: "Ediciones anteriores" })
    .click();
  await expect(page).toHaveURL(/\/archivo$/);
  await expect(page.locator("h1")).toHaveText("El archivo.");
  await page
    .locator("header")
    .getByRole("link", { name: "Buscar", exact: true })
    .click();
  await expect(page.getByLabel("Encuentra un clip o un creador")).toBeFocused();
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  try {
    await desktop.route("https://static-cdn.jtvnw.net/fixture/**", mockPosters);
    await desktop.route("https://clips.twitch.tv/**", (route) => {
      expect(
        route.request().headers()["cf-access-jwt-assertion"],
      ).toBeUndefined();
      return route.fulfill({
        contentType: "text/html",
        body: "<h1>Destino de reproducción de prueba</h1>",
      });
    });
    const view = await desktop.newPage();
    await view.goto("/dia/" + edition.date);
    await view.keyboard.press("Tab");
    await expect(
      view.getByRole("link", { name: "Saltar al contenido" }),
    ).toBeFocused();
    await view.keyboard.press("Enter");
    await expect(view.locator("main")).toBeFocused();
    await view.locator(".catalog-card a").first().focus();
    await expect(view.locator(".catalog-card a").first()).toBeFocused();
    await view.goto("/dia/" + edition.date);
    await view.screenshot({
      path: test.info().outputPath("catalog-desktop.png"),
      fullPage: true,
    });
    expect(
      await view.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const popup = desktop.waitForEvent("page");
    await view
      .getByRole("link", { name: "Reproducir en Twitch", exact: true })
      .click();
    const source = await popup;
    await source.waitForLoadState();
    expect(source.url()).toBe("https://clips.twitch.tv/CatalogBrowser2");
  } finally {
    await desktop.close();
  }
});

test("cambiar la fuente en el editor descarta imagen y duración del clip anterior", async ({
  page,
  request,
}) => {
  const token = await readFile(".wrangler/e2e/editor-token", "utf8");
  const auth = { "Cf-Access-Jwt-Assertion": token };
  await page.route("**/admin**", (route) =>
    route.continue({ headers: { ...route.request().headers(), ...auth } }),
  );
  const edition = {
    date: "2096-03-04",
    title: "Metadatos editoriales",
    intro: "Prueba aislada",
    hook: "Prueba",
    demo: true,
    reviewed: false,
    featured: "OriginalPosterClip",
    clips: [
      {
        url: "https://clips.twitch.tv/OriginalPosterClip",
        title: "Imagen original",
        streamer: "Creador de prueba",
        text: "Contexto original",
        category: "Detalles",
        thumbnail: "https://static-cdn.jtvnw.net/fixture/catalog-0.jpg",
        duration: 35,
      },
    ],
  };
  const created = await request.post("/admin/publish", {
    headers: { ...auth, Origin: "http://127.0.0.1:8788" },
    data: { edition, revision: 0 },
  });
  expect(created.status()).toBe(200);
  await page.goto("/admin?date=2096-03-04");
  const card = page.locator(".clip-input").first();
  await expect(card.getByLabel("Miniatura de Twitch")).toHaveValue(
    "https://static-cdn.jtvnw.net/fixture/catalog-0.jpg",
  );
  await card
    .getByLabel("URL del clip")
    .fill("https://clips.twitch.tv/ReplacementCatalogClip");
  await expect(card.getByLabel("Miniatura de Twitch")).toHaveValue("");
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Borrador guardado");
  const saved = await request.get("/admin/data?date=2096-03-04", {
    headers: auth,
  });
  expect(saved.status()).toBe(200);
  const clip = (await saved.json()).edition.clips[0];
  expect(clip.thumbnail).toBeUndefined();
  expect(clip.duration).toBeUndefined();
  expect(clip.url).toBe("https://clips.twitch.tv/ReplacementCatalogClip");
  const published = await (await request.get("/dia/2096-03-04")).text();
  expect(published).not.toContain("ReplacementCatalogClip");
});
