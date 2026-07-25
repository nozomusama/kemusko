// Yılanın Yolu (komut dizisi) bölüm üreticisinin denetimi.
// Kullanım: node tools/test-komut-generator.mjs
// games/komut/index.html içindeki GEN bloğunu ve TIERS tablosunu çıkarır;
// her kademe için bölümler üretip şunları kanıtlar: çözüm dizisi gerçekten
// hedefe götürüyor, engeller yolu kapatmıyor, ⭐/🔑 yol üstünde ve toplanabilir,
// üretim telefonda takılma yaratmayacak kadar hızlı.
import { readFileSync } from "fs";

const html = readFileSync(new URL("../games/komut/index.html", import.meta.url), "utf8");
const gen = html.match(/\/\*GEN_START\*\/([\s\S]*?)\/\*GEN_END\*\//);
const tiersM = html.match(/\/\*TIERS_START\*\/([\s\S]*?)\/\*TIERS_END\*\//);
if (!gen || !tiersM) { console.error("GEN/TIERS bloğu bulunamadı"); process.exit(1); }

// GEN bloğu ROCKS sabitine bağlı; test için aynısını sağlıyoruz
const api = new Function(
  'var ROCKS = ["🪨","🌳","🌵"];' + gen[1] +
  "; return { generateLevel: generateLevel, validateLevel: validateLevel };"
)();
const TIERS = JSON.parse(tiersM[1]);

const ROUNDS = 30;
let fail = 0;
const err = (m) => { console.error("✘ " + m); fail++; };
const k = (x, y) => x + "," + y;

TIERS.forEach((p, ti) => {
  const t0 = Date.now();
  let slowest = 0;
  for (let r = 0; r < ROUNDS; r++) {
    const s0 = Date.now();
    const lv = api.generateLevel(p);
    slowest = Math.max(slowest, Date.now() - s0);
    if (!lv) { err(`kademe ${ti}: üretim başarısız`); continue; }

    // 1) Çözüm dizisini yürüt: gerçekten hedefe götürmeli
    let x = lv.start[0], y = lv.start[1];
    let gotKey = false, gotStar = false, blocked = false;
    for (const d of lv.solution) {
      x += d[0]; y += d[1];
      if (x < 0 || x >= lv.w || y < 0 || y >= lv.h) { blocked = true; break; }
      if (lv.rocks[k(x, y)]) { blocked = true; break; }
      if (lv.key && x === lv.key[0] && y === lv.key[1]) gotKey = true;
      if (lv.star && x === lv.star[0] && y === lv.star[1]) gotStar = true;
    }
    if (blocked) err(`kademe ${ti}: çözüm yolu engele/duvara çarpıyor`);
    else if (x !== lv.goal[0] || y !== lv.goal[1]) err(`kademe ${ti}: çözüm hedefe varmıyor`);
    if (lv.key && !gotKey) err(`kademe ${ti}: anahtar çözüm yolunda değil`);
    if (lv.star && !gotStar) err(`kademe ${ti}: yıldız çözüm yolunda değil`);

    // 2) Adım sayısı ve öge kuralları kademeyle uyuşmalı
    if (lv.solution.length !== p.steps) err(`kademe ${ti}: adım ${lv.solution.length} != ${p.steps}`);
    const wantKey = p.item === "key" || p.item === "keystar";
    const wantStar = p.item === "star" || p.item === "keystar";
    if (wantKey !== !!lv.key) err(`kademe ${ti}: anahtar beklentisi tutmuyor`);
    if (wantStar !== !!lv.star) err(`kademe ${ti}: yıldız beklentisi tutmuyor`);
    if (Object.keys(lv.rocks).length !== p.rocks) err(`kademe ${ti}: engel sayısı tutmuyor`);

    // 2b) Yumurta yılanın dibinde olmamalı: en az min(3, adım) kare uzakta
    const dist = Math.abs(lv.goal[0] - lv.start[0]) + Math.abs(lv.goal[1] - lv.start[1]);
    if (dist < Math.min(3, p.steps)) err(`kademe ${ti}: hedef çok yakın (mesafe ${dist})`);

    // 3) Başlangıç/hedef/öge hücrelerinde engel olmamalı
    for (const cell of [lv.start, lv.goal, lv.key, lv.star]) {
      if (cell && lv.rocks[k(cell[0], cell[1])]) err(`kademe ${ti}: önemli hücrede engel var`);
    }

    // 4) Gömülü doğrulayıcı da onaylamalı
    if (!api.validateLevel(lv)) err(`kademe ${ti}: gömülü doğrulayıcı reddetti`);

    // 5) Döngü kademesinde hamleler tekrar motifi olmalı
    if (p.loop) {
      const half = lv.solution.length / 2;
      if (!Number.isInteger(half)) err(`kademe ${ti}: motif ikiye bölünmüyor`);
      else {
        for (let i = 0; i < half; i++) {
          const a = lv.solution[i], b = lv.solution[i + half];
          if (a[0] !== b[0] || a[1] !== b[1]) { err(`kademe ${ti}: hamleler tekrar etmiyor`); break; }
        }
      }
    }
  }
  const avg = (Date.now() - t0) / ROUNDS;
  if (slowest > 250) err(`kademe ${ti}: en yavaş üretim ${slowest} ms (>250 ms)`);
  console.log(`✔ kademe ${ti}: ${p.w}x${p.h}, ${p.steps} adım, ${p.rocks} engel${p.item ? " +" + p.item : ""}${p.loop ? " +döngü" : ""} — ort ${avg.toFixed(1)} ms, en yavaş ${slowest} ms`);
});

if (fail) { console.error(`\n${fail} hata`); process.exit(1); }
console.log("\nKomut oyunu üreticisi sağlam ✔");
