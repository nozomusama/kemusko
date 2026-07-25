// Eşleştirme oyununun yerleşim/etkileşim testi.
// Kullanım: node tools/smoke-eslestirme.mjs
// Odak: en yüksek kademede (8 çift = 16 kart) kartların YATAY ve kısa
// ekranlarda bile tamamen viewport içinde kalması — taşan kart dokunulamaz
// olur ve tur asla bitirilemezdi.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

function loadChromium() {
  for (const base of [import.meta.url, "/opt/node22/lib/node_modules/"]) {
    try { return createRequire(base)("playwright").chromium; } catch (e) {}
  }
  throw new Error("playwright bulunamadı");
}
const chromium = loadChromium();

const ROOT = new URL("..", import.meta.url).pathname;
const PORT = 8126;
let fail = 0;
const ok = (m) => console.log("✔ " + m);
const err = (m) => { console.error("✘ " + m); fail++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const srv = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
for (let i = 0; i < 50; i++) {
  try { await fetch(`http://localhost:${PORT}/`); break; } catch (e) { await sleep(100); }
}

let browser;
try { browser = await chromium.launch(); }
catch (e) { browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }); }

async function checkViewport(name, vw, vh, tierLevel) {
  const page = await browser.newPage({
    viewport: { width: vw, height: vh }, hasTouch: true, isMobile: true, deviceScaleFactor: 2
  });
  await page.addInitScript(([lvl]) => {
    try { localStorage.setItem("kemal-adapt-eslestirme", JSON.stringify({ level: lvl, streak: 0 })); } catch (e) {}
  }, [tierLevel]);
  page.on("pageerror", (e) => err(name + ": sayfa hatası " + e.message));
  await page.goto(`http://localhost:${PORT}/games/eslestirme/index.html`);
  await sleep(400);

  const r = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".card")];
    const out = cards.filter(c => {
      const b = c.getBoundingClientRect();
      return b.top < 0 || b.left < 0 || b.bottom > window.innerHeight || b.right > window.innerWidth;
    });
    return { total: cards.length, out: out.length };
  });
  if (r.out > 0) err(`${name}: ${r.out}/${r.total} kart viewport DIŞINDA (dokunulamaz → tur bitirilemez)`);
  else ok(`${name}: ${r.total} kartın hepsi görünür ve dokunulabilir`);

  // Etkileşim hâlâ çalışıyor mu: iki kart çevrilebilmeli
  await page.locator(".card").first().click();
  await sleep(150);
  const flipped = await page.evaluate(() => document.querySelectorAll(".card.flipped").length);
  if (flipped >= 1) ok(`${name}: kart çevirme çalışıyor`);
  else err(`${name}: kart çevrilemedi`);
  await page.close();
}

try {
  await checkViewport("yatay 844x390, kademe 5 (16 kart)", 844, 390, 5);
  await checkViewport("dikey 390x844, kademe 5 (16 kart)", 390, 844, 5);
  await checkViewport("kısa dikey 375x553 (SE+çubuk), kademe 5", 375, 553, 5);
  await checkViewport("yatay 844x390, kademe 0 (4 kart)", 844, 390, 0);
} finally {
  await browser.close();
  srv.kill();
}

if (fail) { console.error(`\n${fail} hata`); process.exit(1); }
console.log("\nEşleştirme yerleşimi sağlam ✔");
