// Yılan Kurtarma'nın OYUN İÇİ bölüm üreticisini Node'da sınar.
// Kullanım: node tools/test-yilan-generator.mjs
// games/yilan/index.html içindeki GEN bloğunu ve TIERS tablosunu çıkarır,
// her kademe için bölümler üretir; hepsinin çözülebilir olduğunu ve
// üretimin telefonda takılma yaratmayacak kadar hızlı kaldığını doğrular.
import { readFileSync } from "fs";

const html = readFileSync(new URL("../games/yilan/index.html", import.meta.url), "utf8");
const gen = html.match(/\/\*GEN_START\*\/(.*?)\/\*GEN_END\*\//s);
const tiers = html.match(/\/\*TIERS_START\*\/(.*?)\/\*TIERS_END\*\//s);
if (!gen || !tiers) { console.error("GEN/TIERS bloğu bulunamadı"); process.exit(1); }

const api = new Function(gen[1] + "; return { generateLevel: generateLevel, genSolve: genSolve };")();
const TIERS = JSON.parse(tiers[1]);

const ROUNDS = 30;
let fail = 0;
TIERS.forEach((p, i) => {
  const t0 = Date.now();
  let slowest = 0;
  for (let r = 0; r < ROUNDS; r++) {
    const s0 = Date.now();
    const lv = api.generateLevel(p);
    slowest = Math.max(slowest, Date.now() - s0);
    if (!lv) { console.error(`✘ kademe ${i}: üretim başarısız`); fail++; continue; }
    if (api.genSolve(lv.snakes, lv.w, lv.h) < 1) { console.error(`✘ kademe ${i}: ÇÖZÜLEMEZ bölüm üretildi!`); fail++; }
    if (lv.snakes.length !== p.n) { console.error(`✘ kademe ${i}: yılan sayısı ${lv.snakes.length} != ${p.n}`); fail++; }
  }
  const avg = (Date.now() - t0) / ROUNDS;
  if (slowest > 250) { console.error(`✘ kademe ${i}: en yavaş üretim ${slowest} ms (>250 ms)`); fail++; }
  console.log(`✔ kademe ${i}: ${p.w}x${p.h}, ${p.n} yılan — ${ROUNDS} bölüm, ort ${avg.toFixed(1)} ms, en yavaş ${slowest} ms`);
});

if (fail) { console.error(`\n${fail} hata`); process.exit(1); }
console.log("\nOyun içi üretici sağlam ✔");
