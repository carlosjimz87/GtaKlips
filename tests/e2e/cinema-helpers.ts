import { readFile } from "node:fs/promises";
import {
  expect,
  type APIRequestContext,
  type BrowserContext,
} from "@playwright/test";
export async function seedCinema(
  request: APIRequestContext,
  date: string,
  count = 4,
) {
  const r = await request.post("/admin/publish", {
    headers: {
      "Cf-Access-Jwt-Assertion": await readFile(
        ".wrangler/e2e/editor-token",
        "utf8",
      ),
      Origin: "http://127.0.0.1:8788",
    },
    data: {
      revision: 0,
      edition: {
        date,
        title: "City after dark",
        intro: "Real moments, credited creators.",
        hook: "City",
        demo: true,
        reviewed: false,
        featured: "youtube:abcdefghijk",
        clips: Array.from({ length: count }, (_, i) => ({
          url: [
            "https://youtu.be/abcdefghijk",
            "https://x.com/demo/status/123",
            "https://clips.twitch.tv/CinemaTwitch",
            "https://youtube.com/shorts/abcdefghijl",
          ][i % 4],
          title: [
            "Zebra chase",
            "Night reaction",
            "Corner escape",
            "Quiet detail",
          ][i % 4],
          streamer: "Creator " + i,
          text: "Editorial context " + i,
          category: i % 2 ? "Detalles" : "Jugadas",
          orientation: i === 3 ? "portrait" : "auto",
          duration: 20 + i,
        })),
      },
    },
  });
  expect(r.status()).toBe(200);
}
export async function providers(ctx: BrowserContext) {
  await ctx.route("https://www.youtube.com/iframe_api", (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: `window.YT={Player:class{constructor(frame,options){this.frame=frame;this.options=options;window.fixturePlayer=this;setTimeout(()=>options.events.onReady(),0)}mute(){}playVideo(){this.options.events.onStateChange({data:1})}destroy(){this.frame.remove()}}};window.onYouTubeIframeAPIReady();`,
    }),
  );
  await ctx.route("https://www.youtube.com/embed/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<body style="margin:0;background:#17212a;color:white">YouTube fixture</body>',
    }),
  );
  await ctx.route("https://clips.twitch.tv/embed?**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<body style="margin:0;background:#17212a;color:white">Twitch fixture<button onclick="document.documentElement.requestFullscreen()">Fullscreen</button></body>',
    }),
  );
  await ctx.route("https://platform.twitter.com/widgets.js", (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: `window.twttr={widgets:{createTweet:async(id,target)=>{const frame=document.createElement('iframe');frame.src='https://platform.twitter.com/embed/'+id;frame.title='Complete X post';target.append(frame);return frame;}}};`,
    }),
  );
  await ctx.route("https://platform.twitter.com/embed/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<body style="background:#17212a;color:white">Author, post context, video and original controls</body>',
    }),
  );
}
