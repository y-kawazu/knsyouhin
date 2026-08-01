import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("KN商品の作成画面を表示する", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>KN商品 \| KNレジ用QRコード作成<\/title>/);
  assert.match(html, /商品を撮影/);
  assert.match(html, /商品情報を入力/);
  assert.match(html, /QRコードを作る/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview/);
});

test("KNレジ互換の商品データをQR化する", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /code:\s*makeProductCode\(\),\s*name:\s*cleanName,\s*price:\s*numericPrice/);
  assert.match(page, /QRCode\.toDataURL\(JSON\.stringify\(nextProduct\)/);
  assert.match(page, /capture="environment"/);
  assert.match(page, /Appleのファイルに保存/);
  assert.match(page, /const filename = `\$\{safeName\}\.png`/);
  assert.match(page, /navigator\.share/);
  assert.match(page, /<h2>QRコード<\/h2>/);
  assert.match(page, /QRコードを印刷/);
  assert.match(page, /className="qr-output"/);
  assert.doesNotMatch(page, /商品ラベル|product-label|label-photo/);
});
