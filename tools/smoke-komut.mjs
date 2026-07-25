// Yılanın Yolu (komut dizisi) oyununun uçtan uca tarayıcı testi.
// Kullanım: node tools/smoke-komut.mjs [ekran-görüntüsü-klasörü]
// Gerekenler: Chromium'lu Playwright (bu ortamda global kurulu).
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
const PORT = 8125;
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

const ARROW = { up: "⬆️", down: "⬇️", left: "⬅️", right: "➡️" };

async function newPage(browser, tierLevel) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2
  });
  await page.addInitScript(([lvl]) => {
    try {
      localStorage.setItem("kemal-adapt-komut", JSON.stringify({ level: lvl, streak: 0 }));
      localStorage.setItem("komut-progress", JSON.stringify({ num: 1 }));
    } catch (e) {}
  }, [tierLevel]);
  page.on("pageerror", (e) => err("sayfa hatası: " + e.message));
  await page.goto(`http://localhost:${PORT}/games/komut/index.html`);
  await page.waitForFunction(() => !!window.__komutDebug);
  return page;
}

// Palet tuşuna bas (emoji ile bulunur)
async function press(page, dir) {
  await page.locator(`#pad .key:has-text("${ARROW[dir]}")`).first().click();
  await sleep(60);
}
const play = (page) => page.locator("#play").click();

await waitServer();
let browser;
try { browser = await chromium.launch(); }
catch (e) { browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }); }

try {
  // --- 1) Doğru çözüm: bölüm tamamlanmalı
  const page = await newPage(browser, 0);

  const cal = await page.evaluate(() => {
    const r = document.getElementById("game").getBoundingClientRect();
    const c = document.getElementById("game");
    return { cssW: r.width, cssH: r.height, styleW: parseFloat(c.style.width), styleH: parseFloat(c.style.height) };
  });
  if (Math.abs(cal.cssW - cal.styleW) > 1 || Math.abs(cal.cssH - cal.styleH) > 1) {
    err("canvas CSS boyutu tutarsız");
  } else ok("canvas kalibrasyonu doğru");

  const sol = await page.evaluate(() => window.__komutDebug.solution());
  ok(`kademe 0: çözüm ${sol.length} adım (${sol.map(s => s[0]).join("")})`);
  for (const d of sol) await press(page, d);
  const prog = await page.evaluate(() => window.__komutDebug.program());
  if (prog.length !== sol.length) err(`şeride ${sol.length} kart eklenmeliydi, ${prog.length} var`);
  else ok("ok tuşları şeride kart ekliyor");
  await page.screenshot({ path: shotDir + "/komut-1-program.png" });

  await play(page);
  await page.waitForFunction(() => document.getElementById("celebrate").classList.contains("show"),
    null, { timeout: 10000 }).then(() => ok("doğru program → bölüm tamamlandı"))
    .catch(() => err("doğru program bölümü bitirmedi"));
  await page.screenshot({ path: shotDir + "/komut-2-kutlama.png" });
  await page.waitForFunction(() => document.getElementById("level-badge").textContent === "Bölüm 2",
    null, { timeout: 6000 }).then(() => ok("Bölüm 2'ye geçildi"))
    .catch(() => err("bölüm ilerlemedi"));

  // --- 2) Kart silme: şeritteki karta dokunmak onu siler
  await press(page, "up");
  await press(page, "down");
  const before = await page.evaluate(() => window.__komutDebug.program().length);
  await page.locator("#strip .slot.card").first().click();
  await sleep(120);
  const after = await page.evaluate(() => window.__komutDebug.program().length);
  if (after === before - 1) ok("şeritteki karta dokunmak kartı siliyor");
  else err(`kart silinmedi (${before} → ${after})`);

  // --- 3) Neden-sonuç: yanlış komut → çarpma, kartlar SİLİNMEZ, yılan başa döner
  await page.evaluate(() => { window.__komutDebug.program().length; });
  await page.reload();
  await page.waitForFunction(() => !!window.__komutDebug);
  const lvl = await page.evaluate(() => window.__komutDebug.level());
  // Duvara doğru kesin çarpacak yönü seç
  const wallDir = lvl.start[1] === 0 ? "up" : (lvl.start[0] === 0 ? "left" : "up");
  const need = lvl.start[1] === 0 || lvl.start[0] === 0;
  if (!need) {
    ok("başlangıç kenarda değil, duvar testi atlandı");
  } else {
    for (let i = 0; i < 3; i++) await press(page, wallDir);   // kesin duvara dayanır
    await play(page);
    await sleep(1400);
    const st = await page.evaluate(() => ({
      state: window.__komutDebug.state(),
      prog: window.__komutDebug.program().length,
      tries: window.__komutDebug.attempts()
    }));
    if (st.state === "editing" && st.prog === 3) ok("çarpma sonrası kartlar duruyor, çocuk düzeltebiliyor");
    else err(`çarpma sonrası durum yanlış: ${JSON.stringify(st)}`);
    const celebrating = await page.evaluate(() => document.getElementById("celebrate").classList.contains("show"));
    if (celebrating) err("çarpmaya rağmen bölüm bitti");
    else ok("çarpınca bölüm bitmiyor (kaybetme yok, ceza yok)");
    await page.screenshot({ path: shotDir + "/komut-3-carpma.png" });
  }
  await page.close();

  // --- 4) Bağımlılık (kademe 4): anahtarsız kapı açılmaz
  const p4 = await newPage(browser, 4);
  const l4 = await p4.evaluate(() => window.__komutDebug.level());
  if (!l4.key) err("kademe 4'te anahtar yok");
  const s4 = await p4.evaluate(() => window.__komutDebug.solution());

  // Anahtarı ALMADAN hedefe gitmeyi dene: anahtara varmadan önceki adımları at,
  // bunun yerine tüm çözümü uygula ama anahtar hücresini debug'dan kontrol et
  // (anahtar yol üstünde olduğu için, kısaltılmış bir rota kapıya erken varır)
  const keyIdx = await p4.evaluate(() => {
    const d = window.__komutDebug, lv = d.level(), sol = d.solution();
    const DIRS = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
    let x = lv.start[0], y = lv.start[1];
    for (let i = 0; i < sol.length; i++) {
      const v = DIRS[sol[i]];
      x += v[0]; y += v[1];
      if (lv.key && x === lv.key[0] && y === lv.key[1]) return i;
    }
    return -1;
  });
  if (keyIdx < 0) err("anahtar çözüm yolunda bulunamadı");

  // Tam çözümü uygula → anahtar alınır, kapı açılır, bölüm biter
  for (const d of s4) await press(p4, d);
  await play(p4);
  await p4.waitForFunction(() => document.getElementById("celebrate").classList.contains("show"),
    null, { timeout: 12000 }).then(() => ok("anahtarı alan rota kapıyı açtı, bölüm bitti"))
    .catch(() => err("anahtarlı rota bölümü bitirmedi"));
  await p4.screenshot({ path: shotDir + "/komut-4-anahtar.png" });
  await p4.close();

  // --- 5) ASIL DERS: anahtarı ALMADAN hedefe varmak reddedilmeli
  const p5 = await newPage(browser, 4);
  let tested = false;
  for (let tryNo = 0; tryNo < 8 && !tested; tryNo++) {
    // Anahtarı engel sayarak start→goal rotası ara (anahtarı atlayan yol)
    const bypass = await p5.evaluate(() => {
      const d = window.__komutDebug, lv = d.level();
      if (!lv.key) return null;
      const K = (x, y) => x + "," + y;
      const blocked = {};
      lv.rocks.forEach(r => { blocked[r] = 1; });
      blocked[K(lv.key[0], lv.key[1])] = 1;          // anahtardan geçmek yasak
      const DIRS = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]];
      const q = [[lv.start[0], lv.start[1], []]];
      const seen = { [K(lv.start[0], lv.start[1])]: 1 };
      while (q.length) {
        const [x, y, path] = q.shift();
        if (x === lv.goal[0] && y === lv.goal[1]) return path;
        for (const [n, dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy, k = K(nx, ny);
          if (nx < 0 || nx >= lv.w || ny < 0 || ny >= lv.h || seen[k] || blocked[k]) continue;
          seen[k] = 1;
          q.push([nx, ny, path.concat(n)]);
        }
      }
      return null;
    });
    const slots = await p5.evaluate(() => document.querySelectorAll("#strip .slot").length);
    if (bypass && bypass.length && bypass.length <= slots) {
      for (const d of bypass) await press(p5, d);
      await play(p5);
      await sleep(400 + bypass.length * 400);
      const res = await p5.evaluate(() => ({
        state: window.__komutDebug.state(),
        done: document.getElementById("celebrate").classList.contains("show")
      }));
      if (res.done) err("anahtarsız hedefe varış kabul edildi — bağımlılık kuralı çalışmıyor!");
      else ok("anahtarsız hedefe varış REDDEDİLDİ (kapı kilitli kaldı, bölüm bitmedi)");
      await p5.screenshot({ path: shotDir + "/komut-6-kilitli-kapi.png" });
      tested = true;
    } else {
      await p5.reload();
      await p5.waitForFunction(() => !!window.__komutDebug);
    }
  }
  if (!tested) err("anahtarı atlayan rota bulunamadı, kilit kuralı sınanamadı");
  await p5.close();

  // --- 6) Döngü kademesi (6): motif tekrarlı, 🔁 tuşu görünür
  const p6 = await newPage(browser, 6);
  const l6 = await p6.evaluate(() => window.__komutDebug.level());
  const loopVisible = await p6.evaluate(() =>
    document.getElementById("loopKey").classList.contains("show"));
  if (loopVisible) ok("kademe 6'da 🔁 tekrar tuşu görünüyor");
  else err("kademe 6'da 🔁 tuşu görünmüyor");

  // Yarım programı 🔁 ile çalıştır: tam çözümle aynı sonucu vermeli
  const s6 = await p6.evaluate(() => window.__komutDebug.solution());
  const half = s6.slice(0, s6.length / 2);
  await p6.locator("#loopKey").click();
  for (const d of half) await press(p6, d);
  await play(p6);
  await p6.waitForFunction(() => document.getElementById("celebrate").classList.contains("show"),
    null, { timeout: 12000 }).then(() => ok("🔁 ile yarım program bölümü bitirdi (döngü çalışıyor)"))
    .catch(() => err("🔁 döngüsü bölümü bitirmedi"));
  await p6.screenshot({ path: shotDir + "/komut-5-dongu.png" });
  await p6.close();
} finally {
  await browser.close();
  srv.kill();
}

if (fail) { console.error(`\n${fail} hata`); process.exit(1); }
console.log("\nYılanın Yolu uçtan uca sağlam ✔  (ekran görüntüleri: " + shotDir + ")");
