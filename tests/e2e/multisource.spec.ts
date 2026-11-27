import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const base = "http://127.0.0.1:8788";
async function auth() {
  return {
    "Cf-Access-Jwt-Assertion": await readFile(
      ".wrangler/e2e/editor-token",
      "utf8",
    ),
    Origin: base,
  };
}
const urls = [
  "https://clips.twitch.tv/MixedTwitch",
  "https://youtu.be/abcdefghijk",
  "https://youtube.com/shorts/abcdefghijl",
  "https://x.com/demo/status/123",
  "https://twitter.com/demo/status/124",
];
test("five links through private inbox, prepared selection, editor and explicit reviewed publication", async ({
  page,
  request,
}) => {
  const date = "2094-03-01",
    headers = await auth();
  await page.setExtraHTTPHeaders(headers);
  await page.goto("/admin/inbox?date=" + date);
  await page
    .getByLabel("Enlaces (uno por línea, máximo diez)")
    .fill(urls.join("\n"));
  await page
    .getByRole("button", { name: "Guardar fuentes", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Guardados: 5");
  expect((await request.get("/dia/" + date)).status()).toBe(404);
  await page
    .getByLabel("Enlaces (uno por línea, máximo diez)")
    .fill(urls.join("\n"));
  await page
    .getByRole("button", { name: "Guardar fuentes", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("duplicados: 5");
  const ids = [
    "MixedTwitch",
    "youtube:abcdefghijk",
    "youtube:abcdefghijl",
    "x:123",
    "x:124",
  ];
  for (const [i, id] of ids.entries()) {
    const form = page.locator('[data-candidate="' + id + '"]');
    await form
      .getByLabel("Título", { exact: true })
      .fill("Fuente editorial " + i);
    await form.getByLabel("Crédito del creador").fill("Creador " + i);
    await form.getByLabel("Contexto editorial").fill("Contexto propio " + i);
    await form
      .getByLabel("Categoría", { exact: true })
      .selectOption("Detalles");
    await form.getByRole("button", { name: "Guardar revisión" }).click();
    // The heading is server-rendered, so it only changes once the save has reloaded the page.
    await expect(page.locator('[data-candidate="' + id + '"] h2')).toHaveText(
      "Fuente editorial " + i,
    );
    await expect(page.locator("#selection h2")).toContainText("5/10");
  }
  await page
    .getByRole("button", { name: "Preparar selección", exact: true })
    .click();
  await page.getByRole("link", { name: "Cargar selección en editor" }).click();
  await expect(page.locator(".clip-input")).toHaveCount(5);
  await expect(page.getByRole("status")).toContainText(
    "No se ha guardado ni publicado",
  );
  await page.getByLabel("Título de la edición").fill("Edición revisada");
  await page.getByLabel("Entradilla").fill("Cinco fuentes con contexto");
  await page.getByLabel("Gancho aprobado para X").fill("Cinco momentos");
  const youtube = page.locator(".clip-input").nth(1);
  await youtube.getByLabel("Destacado de la edición").check();
  await page
    .getByRole("button", { name: "Publicar edición", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Confirma");
  expect((await request.get("/dia/" + date)).status()).toBe(404);
  await page.getByLabel("He revisado las fuentes").check();
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Borrador guardado");
  expect((await request.get("/dia/" + date)).status()).toBe(404);
  await page
    .getByRole("button", { name: "Publicar edición", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Edición publicada");
  await expect(page.locator("#post")).toHaveValue(/#clip-youtube:abcdefghijk/);
  // The confirm may fire right after load (async fetch), so the handler must exist before navigating.
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  await page.goto("/admin?selection=" + date);
  await expect(page.getByRole("status")).toContainText("cancelada");
  await page.reload();
  await expect(page.getByRole("status")).toContainText("cancelada");
  const before = await (
    await request.get("/admin/data?date=" + date, { headers })
  ).json();
  expect(before.revision).toBe(2);
  await page.goto("/admin?date=" + date);
  await page.getByLabel("ID del clip").fill("https://youtu.be/abcdefghijk");
  await page.getByRole("button", { name: "Retirar clip", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("retirado");
  const publicHTML = await (await request.get("/dia/" + date)).text();
  expect(publicHTML).not.toContain('id="clip-youtube:abcdefghijk"');
  expect(publicHTML).toContain('id="clip-MixedTwitch"');
});
test("shared X mobile URL can be captured, selected, prepared and loaded into editor", async ({
  page,
  request,
}) => {
  const date = "2094-05-01";
  await page.setExtraHTTPHeaders(await auth());
  await page.goto("/admin/inbox?date=" + date);
  await page
    .getByLabel("Enlaces (uno por línea, máximo diez)")
    .fill(
      "https://x.com/LaTwitchance/status/2123221655715500442?a=mT-Cem3lEJP2T577VF0&s=35",
    );
  await page
    .getByRole("button", { name: "Guardar fuentes", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Guardados: 1");
  const candidate = page.locator('[data-candidate="x:2123221655715500442"]');
  await expect(
    candidate.getByRole("link", { name: "Revisar original" }),
  ).toHaveAttribute(
    "href",
    "https://x.com/LaTwitchance/status/2123221655715500442",
  );
  await expect(
    candidate.getByRole("button", { name: "Quitar de selección", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#selection h2")).toContainText("1/10");
  await page
    .getByRole("button", { name: "Preparar selección", exact: true })
    .click();
  await page.getByRole("link", { name: "Cargar selección en editor" }).click();
  await expect(page.locator('.clip-input [name="url"]')).toHaveValue(
    "https://x.com/LaTwitchance/status/2123221655715500442",
  );
  await expect(page.getByRole("status")).toContainText(
    "No se ha guardado ni publicado",
  );
  expect((await request.get("/dia/" + date)).status()).toBe(404);
});
