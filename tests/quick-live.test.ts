import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { quickPage, quickScript } from "../src/quick-publish";

test("live enrichment preserves manual edits and publishes only after new fields are reviewed", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const candidate = {
      id: "youtube:abcdefghijk",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      title: "Old title",
      text: "",
      streamer: "",
      creator: "",
      category: "Fails",
    };
    let current = { ...candidate };
    let job = "running";
    let published: any;
    await page.route("http://local.test/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/admin/quick.js")
        return route.fulfill({
          contentType: "text/javascript",
          body: quickScript,
        });
      if (path === "/admin/quick/data")
        return route.fulfill({
          json: {
            revision: 0,
            categories: ["Fails"],
            enrichment: [
              { id: candidate.id, candidate: current, job: { status: job } },
            ],
            edition: {
              title: "Edition",
              intro: "Intro",
              hook: "",
              featured: candidate.id,
              clips: [candidate],
            },
          },
        });
      if (path === "/admin/publish") {
        published = route.request().postDataJSON();
        return route.fulfill({ json: { revision: 1 } });
      }
      if (path === "/admin/x/drafts")
        return route.fulfill({ json: { drafts: [], publishEnabled: false } });
      return route.fulfill({ contentType: "text/html", body: quickPage() });
    });
    await page.goto("http://local.test/admin/quick?date=2026-11-21");
    await page.locator("[name=title]").fill("My manual title");
    current = { ...candidate, title: "Automatic title", text: "New context" };
    job = "complete";
    await page.locator("#publish").click();
    await page.waitForFunction(
      () => !document.querySelector<HTMLButtonElement>("#apply-new")!.hidden,
    );
    assert.equal(published, undefined);
    await page.locator("#apply-new").click();
    assert.equal(
      await page.locator("[name=title]").inputValue(),
      "My manual title",
    );
    assert.equal(await page.locator("[name=text]").inputValue(), "New context");
    await page.locator("#publish").click();
    await page.locator("#step2").waitFor({ state: "visible" });
    assert.equal((published as any).edition.clips[0].title, "My manual title");
    assert.equal((published as any).edition.clips[0].text, "New context");
  } finally {
    await browser.close();
  }
});
