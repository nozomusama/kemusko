// Boyama oyununun uçtan uca tarayıcı testi.
// Kullanım: node tools/smoke-boyama.mjs [ekran-görüntüsü-klasörü]
// Gerekenler: Chromium'lu Playwright. Bu ortamda paket global kurulu
// (/opt/node22/lib/node_modules), tarayıcılar PLAYWRIGHT_BROWSERS_PATH'te.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

function loadChromium() {
  for (const base of [import.meta.url, "/opt/node22/lib/node_modules/"]) {
    try { return createRequire(base)("playwright").chromium; } catch (e) {}
  }
  throw new Error("playwright bulunamadı");
}
const chromium = loadChromium();

const ROOT = new URL("..", import.meta.url).pathname;
const PORT = 8123;
const shotDir = process.argv[2] || ROOT + "sekiller";
mkdirSync(shotDir, { recursive: true });

let fail = 0;
const ok = (m) => console.log("✔ " + m);
const err = (m) => { console.error("✘ " + m); fail++; };

const srv = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
async function waitServer() {
  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://localhost:${PORT}/`); return; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error("sunucu açılmadı");
}

async function newPage(browser, tierLevel) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2
  });
  await page.addInitScript(([lvl]) => {
    try {
      localStorage.setItem("kemal-adapt-boyama", JSON.stringify({ level: lvl, streak: 0 }));
      localStorage.setItem("boyama-progress", JSON.stringify({ num: 1, seen: [] }));
    } catch (e) {}
  }, [tierLevel]);
  page.on("pageerror", (e) => err("sayfa hatası: " + e.message));
  await page.goto(`http://localhost:${PORT}/games/boyama/index.html`);
  await page.waitForFunction(() => !!window.__boyamaDebug);
  return page;
}

// Figürün içini zikzak tarayarak boyar
async function scribble(page, { outside = false, rows = 40 } = {}) {
  const bb = await page.evaluate(() => window.__boyamaDebug.bbox());
  const step = bb.brushR * 0.8;
  const x0 = outside ? bb.x - bb.w * 0.4 : bb.x;
  const x1 = outside ? bb.x - bb.w * 0.1 : bb.x + bb.w;
  let n = 0;
  for (let y = bb.y; y < bb.y + bb.h && n < rows; y += step, n++) {
    await page.mouse.move(Math.max(2, x0), y);
    await page.mouse.down();
    await page.mouse.move(Math.max(2, x1), y, { steps: 14 });
    await page.mouse.up();
    if (await page.evaluate(() => window.__boyamaDebug.state()) !== "painting") break;
  }
}

await waitServer();
const browser = await chromium.launch();

try {
  // --- 1) Figür geometri denetimi: tek bağlı bölge + fırçayla doldurulabilirlik
  const page = await newPage(browser, 0);
  const figReport = await page.evaluate(() => {
    var figs = window.__boyamaDebug.figures();
    var N = 96;
    return figs.map(function (f) {
      var cv = document.createElement("canvas");
      var h = Math.round(N * f.aspect);
      cv.width = N; cv.height = h;
      var c = cv.getContext("2d");
      c.save(); c.scale(N, N); c.beginPath(); f.path(c); c.restore();
      c.fillStyle = "#000"; c.fill();
      var d = c.getImageData(0, 0, N, h).data;
      var mask = new Uint8Array(N * h), area = 0;
      for (var i = 0; i < mask.length; i++) {
        if (d[i * 4 + 3] >= 128) { mask[i] = 1; area++; }
      }
      // Bağlı bileşen sayımı (4-komşu flood fill)
      var seen = new Uint8Array(mask.length), comps = 0, biggest = 0;
      for (var s = 0; s < mask.length; s++) {
        if (!mask[s] || seen[s]) continue;
        comps++;
        var stack = [s], size = 0;
        seen[s] = 1;
        while (stack.length) {
          var p = stack.pop(); size++;
          var px = p % N, py = (p / N) | 0;
          var nb = [];
          if (px > 0) nb.push(p - 1);
          if (px < N - 1) nb.push(p + 1);
          if (py > 0) nb.push(p - N);
          if (py < h - 1) nb.push(p + N);
          for (var k = 0; k < nb.length; k++) {
            if (mask[nb[k]] && !seen[nb[k]]) { seen[nb[k]] = 1; stack.push(nb[k]); }
          }
        }
        if (size > biggest) biggest = size;
      }
      // Erozyon: fırça yarıçapı kadar içeri çekilince ne kadar alan kalıyor?
      // (doluluk eşiğinin kalın fırçayla ulaşılabilir olduğunun göstergesi)
      var r = 3;   // 96 px ızgarada tipik fırça ~%3
      var eroded = 0;
      for (var y2 = 0; y2 < h; y2++) {
        for (var x2 = 0; x2 < N; x2++) {
          if (!mask[y2 * N + x2]) continue;
          var okp = true;
          for (var dy = -r; dy <= r && okp; dy++) {
            for (var dx = -r; dx <= r && okp; dx++) {
              var nx = x2 + dx, ny = y2 + dy;
              if (nx < 0 || nx >= N || ny < 0 || ny >= h || !mask[ny * N + nx]) okp = false;
            }
          }
          if (okp) eroded++;
        }
      }
      return { id: f.id, comps: comps, fillRatio: area / (N * h),
               strayRatio: 1 - biggest / Math.max(area, 1), erodeRatio: eroded / Math.max(area, 1) };
    });
  });
  figReport.forEach(function (r) {
    if (r.comps !== 1) err(`figür ${r.id}: ${r.comps} ayrı parça (tek bölge olmalı)`);
    if (r.fillRatio < 0.2 || r.fillRatio > 0.85) err(`figür ${r.id}: alan oranı ${r.fillRatio.toFixed(2)} aşırı`);
    if (r.erodeRatio < 0.45) err(`figür ${r.id}: fırça için fazla ince (erozyon sonrası %${Math.round(r.erodeRatio * 100)})`);
  });
  if (!fail) ok(`12 figür geometrisi sağlam (hepsi tek parça, fırçayla doldurulabilir)`);
  await page.screenshot({ path: shotDir + "/boyama-1-baslangic.png" });

  // --- 2) Kademe 0: boya dışarı TAŞAMAZ + bölüm bitip ilerliyor
  await scribble(page);
  const m0 = await page.evaluate(() => window.__boyamaDebug.measureNow());
  ok(`kademe 0: doluluk %${Math.round(m0.coverage * 100)}`);
  await page.screenshot({ path: shotDir + "/boyama-2-boyanmis.png" });
  await page.waitForFunction(() => document.getElementById("celebrate").classList.contains("show"),
    null, { timeout: 15000 }).then(() => ok("bölüm bitti, kutlama açıldı"))
    .catch(() => err("kutlama açılmadı"));
  await page.screenshot({ path: shotDir + "/boyama-3-kutlama.png" });
  await page.waitForFunction(() => document.getElementById("level-badge").textContent === "Bölüm 2",
    null, { timeout: 8000 }).then(() => ok("Bölüm 2'ye geçildi"))
    .catch(() => err("bölüm ilerlemedi"));

  // Kademe 0'da figür dışına çizip taşmanın GÖRÜNMEDİĞİNİ doğrula
  await page.evaluate(() => window.__boyamaDebug.measureNow());
  await scribble(page, { outside: true, rows: 6 });
  const spill0 = await page.evaluate(() => window.__boyamaDebug.measureNow());
  if (spill0.overflow > 0) ok(`kademe 0: taşma gizlice ölçülüyor (${spill0.overflow.toFixed(2)}) ama ekranda görünmüyor`);
  else err("kademe 0: dışarı çizilen boya hiç ölçülmedi");
  await page.close();

  // --- 3) Kademe 4: taşma kalıcı, sünger temizliyor, bölüm ancak temizken bitiyor
  const p4 = await newPage(browser, 4);
  await scribble(p4, { outside: true, rows: 8 });
  const before = await p4.evaluate(() => window.__boyamaDebug.measureNow());
  if (before.overflow > 0) ok(`kademe 4: taşma kalıcı (${before.overflow.toFixed(2)})`);
  else err("kademe 4: taşma ölçülmedi");
  await p4.screenshot({ path: shotDir + "/boyama-4-tasma.png" });

  await scribble(p4);   // içini doldur
  const filled = await p4.evaluate(() => window.__boyamaDebug.measureNow());
  const st = await p4.evaluate(() => window.__boyamaDebug.state());
  if (filled.overflow > 0.06 && st === "painting") ok("kademe 4: taşma varken bölüm bitmiyor (doğru)");
  else if (st !== "painting") err("kademe 4: taşma varken bölüm bitti (olmamalı)");

  const hint = await p4.evaluate(() => document.getElementById("sponge").classList.contains("hint"));
  if (hint) ok("sünger ipucu animasyonu açık");
  // force: ipucu animasyonu yüzünden Playwright "kararsız" sayıyor (gerçek parmak basabilir)
  await p4.locator("#sponge").click({ force: true });
  const after = await p4.evaluate(() => window.__boyamaDebug.measureNow());
  if (after.overflow === 0) ok("sünger taşan boyayı temizledi");
  else err(`sünger sonrası taşma kaldı: ${after.overflow}`);
  await p4.waitForFunction(() => document.getElementById("celebrate").classList.contains("show"),
    null, { timeout: 8000 }).then(() => ok("temizlik sonrası bölüm bitti"))
    .catch(() => err("temizlik sonrası bölüm bitmedi"));
  await p4.screenshot({ path: shotDir + "/boyama-5-sunger-sonrasi.png" });
  await p4.close();
} finally {
  await browser.close();
  srv.kill();
}

if (fail) { console.error(`\n${fail} hata`); process.exit(1); }
console.log("\nBoyama oyunu uçtan uca sağlam ✔  (ekran görüntüleri: " + shotDir + ")");
