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

// Dokunma noktası ile boyanan yer aynı mı? (canvas gerilme kalibrasyonu)
async function checkCalibration(page) {
  const probe = await page.evaluate(async () => {
    var d = window.__boyamaDebug;
    var bb = d.bbox();
    // Figürün tam ortasına tek damla: dokunma → boya aynı noktada mı?
    var cx = Math.round(bb.x + bb.w / 2), cy = Math.round(bb.y + bb.h / 2);
    var cv = document.getElementById("game");
    var r = cv.getBoundingClientRect();
    return { cx: cx, cy: cy, rectW: r.width, rectH: r.height,
             innerW: window.innerWidth, innerH: window.innerHeight,
             left: r.left, top: r.top };
  });
  if (Math.abs(probe.rectW - probe.innerW) > 1 || Math.abs(probe.rectH - probe.innerH) > 1) {
    err(`canvas CSS boyutu görünür alandan farklı (${probe.rectW}x${probe.rectH} vs ${probe.innerW}x${probe.innerH}) — dokunma kayar`);
  } else {
    ok("canvas kalibrasyonu doğru (CSS boyutu = görünür alan)");
  }
}

await waitServer();
// Ses testi için otomatik oynatma kilidini aç (WebAudio headless'ta da çalışır)
const launchOpts = { args: ["--autoplay-policy=no-user-gesture-required"] };
let browser;
try { browser = await chromium.launch(launchOpts); }
catch (e) { browser = await chromium.launch({ ...launchOpts, executablePath: "/opt/pw-browsers/chromium" }); }

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

  await checkCalibration(page);

  // --- Ses: parmak kalkınca sürtme sesi TAMAMEN susmalı ("bozuk plak" regresyonu)
  {
    const bb = await page.evaluate(() => window.__boyamaDebug.bbox());
    const y = bb.y + bb.h / 2;
    await page.mouse.move(bb.x + 10, y);
    await page.mouse.down();
    const duringP = page.evaluate(() => window.__boyamaDebug.audioLevel(250));
    for (let i = 0; i < 12; i++) {          // ölçüm boyunca sürtmeye devam
      await page.mouse.move(bb.x + 10 + (i % 2 ? 40 : 10), y, { steps: 3 });
      await new Promise(r => setTimeout(r, 25));
    }
    const during = await duringP;
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 800));
    const after = await page.evaluate(() => window.__boyamaDebug.audioLevel(250));
    if (during < 0) ok("ses motoru headless'ta yok, ses testi atlandı");
    else if (during <= 0.0005) err(`sürtme sırasında ses çıkmıyor (seviye ${during.toExponential(1)})`);
    else if (after > 0.0005) err(`parmak kalkınca ses susmuyor! (sürerken ${during.toFixed(4)} → sonra ${after.toFixed(4)})`);
    else ok(`sürtme sesi çalışıyor (${during.toFixed(4)}) ve parmak kalkınca susuyor (${after.toExponential(1)})`);
  }

  // --- 2) Kademe 0: boya dışarı TAŞAMAZ; dolunca "bitti" butonu çıkar ama
  //        bölüm KENDİLİĞİNDEN geçmez — çocuk boyamaya devam edebilir
  await scribble(page);
  const m0 = await page.evaluate(() => window.__boyamaDebug.measureNow());
  ok(`kademe 0: doluluk %${Math.round(m0.coverage * 100)}`);
  await page.screenshot({ path: shotDir + "/boyama-2-boyanmis.png" });

  await page.waitForFunction(() => window.__boyamaDebug.ready(), null, { timeout: 10000 })
    .then(() => ok("yeterince dolunca 'bitti' butonu belirdi"))
    .catch(() => err("'bitti' butonu belirmedi"));
  if (await page.evaluate(() => document.getElementById("celebrate").classList.contains("show"))) {
    err("bölüm kendiliğinden geçti (çocuğun kararı olmalıydı)");
  } else {
    ok("bölüm kendiliğinden geçmiyor, karar çocuğun");
  }
  // Devam boyayabiliyor mu?
  await scribble(page, { rows: 3 });
  if (await page.evaluate(() => window.__boyamaDebug.state()) === "painting") {
    ok("buton çıktıktan sonra boyamaya devam edilebiliyor");
  } else err("buton çıkınca boyama kilitlendi");
  await page.screenshot({ path: shotDir + "/boyama-3-bitti-butonu.png" });

  await page.locator("#next").click({ force: true });
  await page.waitForFunction(() => document.getElementById("celebrate").classList.contains("show"),
    null, { timeout: 5000 }).then(() => ok("butona basınca kutlama açıldı"))
    .catch(() => err("butona basınca kutlama açılmadı"));
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
  await p4.waitForFunction(() => window.__boyamaDebug.ready(), null, { timeout: 8000 })
    .then(() => ok("temizlik sonrası 'bitti' butonu açıldı"))
    .catch(() => err("temizlik sonrası buton açılmadı"));
  await p4.locator("#next").click({ force: true });
  await p4.waitForFunction(() => document.getElementById("celebrate").classList.contains("show"),
    null, { timeout: 5000 }).then(() => ok("kademe 4 bölümü tamamlandı"))
    .catch(() => err("kademe 4 bölümü tamamlanmadı"));
  await p4.screenshot({ path: shotDir + "/boyama-5-sunger-sonrasi.png" });
  await p4.close();
} finally {
  await browser.close();
  srv.kill();
}

if (fail) { console.error(`\n${fail} hata`); process.exit(1); }
console.log("\nBoyama oyunu uçtan uca sağlam ✔  (ekran görüntüleri: " + shotDir + ")");
