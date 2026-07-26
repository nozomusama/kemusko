// Kamera oyunlarının uçtan uca testi (sahte kamera ile).
// Kullanım: node tools/smoke-kamera.mjs
// Chromium'un sahte kamera cihazı (--use-fake-device-for-media-stream)
// hareketli bir test deseni üretir: piksel-farkı algılama gerçekten çalışır.
// İzin ekranı --use-fake-ui-for-media-stream ile otomatik onaylanır.
// Poz/yüz oyunlarında gömülü MediaPipe'ın başsız ortamda gerçekten
// yüklendiği doğrulanır (GPU açılmazsa CPU'ya düşüş dahil); sahte desende
// insan olmadığı için poz eşleşmesi beklenmez, oyun mekaniği debug
// kancalarıyla sürülür.
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
const SHOTS = new URL("../sekiller/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const PORT = 8127;
let fail = 0;
const ok = (m) => console.log("✔ " + m);
const err = (m) => { console.error("✘ " + m); fail++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const srv = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
for (let i = 0; i < 50; i++) {
  try { await fetch(`http://localhost:${PORT}/`); break; } catch (e) { await sleep(100); }
}

const LAUNCH_ARGS = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"];
let browser;
try { browser = await chromium.launch({ args: LAUNCH_ARGS }); }
catch (e) { browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: LAUNCH_ARGS }); }

async function newPage(name) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => err(`${name}: sayfa hatası ${e.message}`));
  return page;
}

// koşul sağlanana dek bekle (poll)
async function waitFor(page, name, desc, fn, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    let v;
    try { v = await page.evaluate(fn); } catch (e) { v = false; }
    if (v) { ok(`${name}: ${desc}`); return true; }
    await sleep(200);
  }
  err(`${name}: ${desc} — ${timeoutMs} ms içinde olmadı`);
  return false;
}

// Kamera oyununu izin ekranından oyuna kadar getirir
async function enterGame(page, name, path) {
  await page.goto(`http://localhost:${PORT}/games/kamera/${path}/index.html`);
  await waitFor(page, name, "izin ekranı göründü", () =>
    !!document.querySelector(".kk-btn"), 5000);
  await page.locator("button.kk-btn").first().click();
  await waitFor(page, name, "video hazır", () => {
    const v = document.querySelector(".kk-video");
    return v && v.readyState >= 2 && v.videoWidth > 0;
  }, 8000);
  await sleep(400);   // ısınma ekranı kurulsun
  await page.evaluate(() => window.__kameraDebug.skipWarmup());
}

try {
  // --- 1) Merkez sayfası ---
  {
    const page = await newPage("merkez");
    await page.goto(`http://localhost:${PORT}/games/kamera/index.html`);
    const n = await page.locator("a.game-btn").count();
    if (n === 4) ok("merkez: 4 oyun butonu var");
    else err(`merkez: 4 buton beklenirdi, ${n} var`);
    if (await page.locator(".home-btn").count()) ok("merkez: 🏠 var");
    else err("merkez: 🏠 yok");
    await page.screenshot({ path: SHOTS + "kamera-merkez.png" });
    await page.close();
  }

  // --- 2) 🎈 Balon: hareket algılama + tur akışı + telemetri ---
  {
    const page = await newPage("balon");
    await enterGame(page, "balon", "balon");
    await waitFor(page, "balon", "oyun başladı", () => window.__kameraDebug.playing(), 5000);
    // Sahte kamera deseni hareketli: piksel-farkı gerçekten sıfırdan büyümeli
    await waitFor(page, "balon", "hareket algılanıyor (motion.global > 0)", () =>
      window.__kameraDebug.motionGlobal() > 0, 6000);
    const s0 = await page.evaluate(() => window.__kameraDebug.stars());
    await page.evaluate(() => { window.__kameraDebug.forcePop(); window.__kameraDebug.forcePop(); });
    const s1 = await page.evaluate(() => window.__kameraDebug.stars());
    if (s1 === s0 + 2) ok("balon: patlatma yıldız sayacını artırıyor");
    else err(`balon: 2 patlatma sonrası yıldız ${s0} → ${s1}`);
    await page.screenshot({ path: SHOTS + "kamera-balon.png" });
    await page.evaluate(() => window.__kameraDebug.finishRound());
    await waitFor(page, "balon", "kutlama göründü", () =>
      document.getElementById("celebrate").classList.contains("show"), 3000);
    const tele = await page.evaluate(() => {
      try { return (JSON.parse(localStorage.getItem("kemal-telemetry-kamera-balon")) || []).length; }
      catch (e) { return 0; }
    });
    if (tele >= 1) ok(`balon: telemetri yazıldı (${tele} kayıt)`);
    else err("balon: telemetri kaydı yok");
    await page.close();
  }

  // --- 3) 🕺 Dans: müzik fazı + donma akışı ---
  {
    const page = await newPage("dans");
    await enterGame(page, "dans", "dans");
    await waitFor(page, "dans", "dans fazı başladı", () =>
      window.__kameraDebug.phase() === "dans", 5000);
    await page.evaluate(() => window.__kameraDebug.forceFreeze());
    await waitFor(page, "dans", "donma fazına geçti", () =>
      window.__kameraDebug.phase() === "don", 3000);
    await page.screenshot({ path: SHOTS + "kamera-dans.png" });
    await page.evaluate(() => window.__kameraDebug.forceFreezeDone());
    const s = await page.evaluate(() => window.__kameraDebug.stars());
    if (s >= 1) ok("dans: donma başarısı yıldız veriyor");
    else err("dans: donma sonrası yıldız yok");
    await page.close();
  }

  // --- 4) 🤸 Taklit: gömülü MediaPipe poz modeli başsız yükleniyor ---
  {
    const page = await newPage("taklit");
    await enterGame(page, "taklit", "taklit");
    await waitFor(page, "taklit", "poz modeli yüklendi (wasm+task, gerekirse CPU)", () =>
      window.__kameraDebug.detectorReady(), 45000);
    await waitFor(page, "taklit", "oyun başladı", () => window.__kameraDebug.playing(), 5000);
    const pid = await page.evaluate(() => window.__kameraDebug.poseId());
    if (pid) ok(`taklit: hedef poz seçildi (${pid})`);
    else err("taklit: hedef poz yok");
    await page.evaluate(() => window.__kameraDebug.forceMatch());
    const s = await page.evaluate(() => window.__kameraDebug.stars());
    if (s >= 1) ok("taklit: poz başarısı yıldız veriyor");
    else err("taklit: poz sonrası yıldız yok");
    await page.screenshot({ path: SHOTS + "kamera-taklit.png" });
    await page.close();
  }

  // --- 5) 🍎 Ağzını Aç: gömülü MediaPipe yüz modeli başsız yükleniyor ---
  {
    const page = await newPage("agzini-ac");
    await enterGame(page, "agzini-ac", "agzini-ac");
    await waitFor(page, "agzini-ac", "yüz modeli yüklendi (wasm+task, gerekirse CPU)", () =>
      window.__kameraDebug.detectorReady(), 45000);
    await waitFor(page, "agzini-ac", "oyun başladı", () => window.__kameraDebug.playing(), 5000);
    await page.evaluate(() => window.__kameraDebug.forceEat());
    const s = await page.evaluate(() => window.__kameraDebug.stars());
    if (s >= 1) ok("agzini-ac: meyve yeme yıldız veriyor");
    else err("agzini-ac: meyve sonrası yıldız yok");
    await page.screenshot({ path: SHOTS + "kamera-agzini-ac.png" });
    await page.close();
  }

  // --- 6) Model engellenirse: boş sayfa değil, "robot uykuda 😴" ekranı ---
  {
    const page = await newPage("uyku");
    await page.route("**/vendor/mediapipe/**", (r) => r.abort());
    await enterGame(page, "uyku", "taklit");
    await waitFor(page, "uyku", "😴 ekranı göründü (asla boş sayfa yok)", () => {
      const b = document.querySelector(".kk-big");
      const o = document.querySelector(".kk-overlay");
      return b && o && o.style.display !== "none" && b.textContent.includes("😴");
    }, 30000);
    const links = await page.evaluate(() =>
      [...document.querySelectorAll(".kk-overlay a.kk-btn, .kk-overlay .kk-home")].length);
    if (links >= 3) ok("uyku: çıkış yolları var (🎈/🕺/🏠)");
    else err(`uyku: çıkış bağlantıları eksik (${links})`);
    await page.screenshot({ path: SHOTS + "kamera-uyku.png" });
    await page.close();
  }
} finally {
  await browser.close();
  srv.kill();
}

if (fail) { console.error(`\n${fail} hata`); process.exit(1); }
console.log("\nKamera oyunları uçtan uca sağlam ✔");
