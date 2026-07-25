// Yılan Kurtarma'nın tarayıcıdaki davranış testi.
// Kullanım: node tools/smoke-yilan.mjs [ekran-görüntüsü-klasörü]
// Odak: kaçmakta olan yılan ilerledikçe arkasındaki hücreleri serbest
// bırakmalı (önü açılan yılan, kaçanın ekrandan çıkmasını beklememeli),
// ama hâlâ DOLU olan bir yoldan geçmeye izin verilmemeli.
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
const PORT = 8124;
const shotDir = process.argv[2] || ROOT + "sekiller";
mkdirSync(shotDir, { recursive: true });

let fail = 0;
const ok = (m) => console.log("✔ " + m);
const err = (m) => { console.error("✘ " + m); fail++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const srv = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
async function waitServer() {
  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://localhost:${PORT}/`); return; } catch (e) {}
    await sleep(100);
  }
  throw new Error("sunucu açılmadı");
}

await waitServer();
let browser;
try { browser = await chromium.launch(); }
catch (e) { browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }); }

try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2
  });
  page.on("pageerror", (e) => err("sayfa hatası: " + e.message));
  // Bölüm 3'ü sabitle: 2 yılan, biri diğerinin yolunu kapatıyor (2 kurtarma dalgası)
  await page.addInitScript(() => {
    try {
      localStorage.setItem("kemal-adapt-yilan", JSON.stringify({ level: 2, streak: 0 }));
      localStorage.setItem("yilan-progress2", JSON.stringify({ num: 1, seen: [] }));
    } catch (e) {}
  });
  await page.goto(`http://localhost:${PORT}/games/yilan/index.html`);
  await page.waitForFunction(() => !!window.__yilanDebug);

  // Kalibrasyon: canvas gerilmiş olmamalı, yoksa dokunma kayar
  const cal = await page.evaluate(() => {
    var r = document.getElementById("game").getBoundingClientRect();
    return { w: r.width, h: r.height, iw: window.innerWidth, ih: window.innerHeight };
  });
  if (Math.abs(cal.w - cal.iw) > 1 || Math.abs(cal.h - cal.ih) > 1) {
    err(`canvas gerilmiş (${cal.w}x${cal.h} vs ${cal.iw}x${cal.ih}) — dokunma kayar`);
  } else ok("canvas kalibrasyonu doğru");

  const snakes = await page.evaluate(() => window.__yilanDebug.snakes());
  if (snakes.length !== 2) err(`beklenen 2 yılan, ${snakes.length} var`);
  // Yolu açık olan: başı (1,1); yolu kapalı olan: başı (2,2)
  const iFree = snakes.findIndex(s => s.head[0] === 1 && s.head[1] === 1);
  const iBlocked = snakes.findIndex(s => s.head[0] === 2 && s.head[1] === 2);
  if (iFree < 0 || iBlocked < 0) err("beklenen bölüm düzeni yüklenmedi");

  const tap = async (idx) => {
    const s = await page.evaluate((i) => {
      var d = window.__yilanDebug;
      var head = d.snakes()[i].head;
      return d.cellPos(head[0], head[1]);
    }, idx);
    await page.mouse.click(s.x, s.y);
  };
  const stateOf = (i) => page.evaluate((k) => window.__yilanDebug.snakes()[k].state, i);

  // 1) Yolu kapalı yılan gerçekten engelleniyor mu? (kural korunmalı)
  await tap(iBlocked);
  await sleep(120);
  if (await stateOf(iBlocked) === "idle") ok("yolu kapalı yılan hareket etmiyor (kural korunuyor)");
  else err("yolu kapalı yılan hareket etti — kural bozuldu");

  // 2) Önündeki yılanı kurtar
  await tap(iFree);
  await sleep(100);
  if (await stateOf(iFree) === "escaping") ok("yolu açık yılan kaçmaya başladı");
  else err("yolu açık yılan hareket etmedi");

  // 3) Kaçan yılan HÂLÂ EKRANDAYKEN, önü açılan yılan hareket edebilmeli
  await sleep(600);
  const stillOnScreen = await stateOf(iFree);
  if (stillOnScreen !== "escaping") {
    err("test kurgusu: kaçan yılan çok hızlı çıktı, senaryo doğrulanamadı");
  } else {
    await page.screenshot({ path: shotDir + "/yilan-1-kacarken.png" });
    await tap(iBlocked);
    await sleep(150);
    const st = await stateOf(iBlocked);
    if (st === "escaping") ok("kaçan yılan ekrandayken önü açılan yılan hareket etti ✔ (asıl düzeltme)");
    else err("önü açıldığı halde yılan hareket etmedi (kaçanın çıkması bekleniyor)");
    await page.screenshot({ path: shotDir + "/yilan-2-ikisi-birden.png" });
  }

  // 4) Bölüm tamamlanıyor mu?
  await page.waitForFunction(() => document.getElementById("celebrate").classList.contains("show"),
    null, { timeout: 8000 }).then(() => ok("bölüm tamamlandı, kutlama açıldı"))
    .catch(() => err("bölüm tamamlanmadı"));
  await page.close();
} finally {
  await browser.close();
  srv.kill();
}

if (fail) { console.error(`\n${fail} hata`); process.exit(1); }
console.log("\nYılan Kurtarma davranışı sağlam ✔  (ekran görüntüleri: " + shotDir + ")");
