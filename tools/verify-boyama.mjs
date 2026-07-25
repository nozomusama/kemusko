// Boyama oyununun kademe (TIERS) ve figür (FIGURES) verisini denetler.
// Kullanım: node tools/verify-boyama.mjs
// Oyun script'inin sözdizimini de doğrular (çalıştırmadan).
import { readFileSync } from "fs";

const html = readFileSync(new URL("../games/boyama/index.html", import.meta.url), "utf8");

let fail = 0;
const err = (msg) => { console.error("✘ " + msg); fail++; };

// 1) Script sözdizimi
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (!scripts.length) err("script bloğu bulunamadı");
scripts.forEach((m, i) => {
  try { new Function(m[1]); } catch (e) { err(`script #${i} sözdizimi: ${e.message}`); }
});

// 2) TIERS
const tm = html.match(/\/\*TIERS_START\*\/([\s\S]*?)\/\*TIERS_END\*\//);
if (!tm) err("TIERS bloğu yok");
else {
  const TIERS = JSON.parse(tm[1]);
  if (TIERS.length < 4) err("en az 4 kademe olmalı");
  TIERS.forEach((t, i) => {
    if (!["none", "fade", "stick"].includes(t.show)) err(`kademe ${i}: geçersiz show="${t.show}"`);
    if (!(t.cover > 0 && t.cover <= 1)) err(`kademe ${i}: cover aralık dışı`);
    if (t.show === "stick" && !(t.maxOver > 0 && t.maxOver < 1)) err(`kademe ${i}: stick için maxOver gerekli`);
    if (t.show === "fade" && !(t.fade > 0)) err(`kademe ${i}: fade süresi gerekli`);
    if (i > 0 && t.cover < TIERS[i - 1].cover) err(`kademe ${i}: doluluk eşiği geriliyor`);
  });
  // Taşma sertliği monoton artmalı: none → fade → stick
  const rank = { none: 0, fade: 1, stick: 2 };
  TIERS.forEach((t, i) => {
    if (i > 0 && rank[t.show] < rank[TIERS[i - 1].show]) err(`kademe ${i}: taşma modu yumuşuyor`);
  });
  console.log(`✔ TIERS: ${TIERS.length} kademe (${TIERS.map(t => t.show).join(" → ")})`);
}

// 3) FIGURES — id benzersizliği, alan sayısı, path fonksiyonu var mı
const fm = html.match(/\/\*FIGURES_START\*\/([\s\S]*?)\/\*FIGURES_END\*\//);
if (!fm) err("FIGURES bloğu yok");
else {
  const FIGURES = new Function("return " + fm[1])();
  if (FIGURES.length < 10) err(`en az 10 figür gerekli, ${FIGURES.length} var`);
  const ids = new Set();
  let easy = 0;
  FIGURES.forEach((f, i) => {
    if (!f.id) err(`figür ${i}: id yok`);
    if (ids.has(f.id)) err(`figür ${i}: tekrarlanan id "${f.id}"`);
    ids.add(f.id);
    if (!f.emoji) err(`figür ${f.id}: emoji yok`);
    if (typeof f.path !== "function") err(`figür ${f.id}: path fonksiyonu yok`);
    if (!(f.aspect > 0.4 && f.aspect < 2.2)) err(`figür ${f.id}: aspect aşırı (${f.aspect})`);
    if (f.pool === 0) easy++;
  });
  if (easy < 3) err(`kolay havuzda en az 3 figür olmalı, ${easy} var`);
  console.log(`✔ FIGURES: ${FIGURES.length} figür (${easy} kolay) — ${[...ids].join(", ")}`);
}

// 4) Kalıp tutarlılığı
if (!html.includes('src="../shared/adapt.js"')) err("adapt.js dahil edilmemiş");
if (!html.includes("KemalAdapt.create")) err("KemalAdapt.create çağrısı yok");
if (!html.includes("__boyamaDebug")) err("test kancası yok");

if (fail) { console.error(`\n${fail} hata`); process.exit(1); }
console.log("\nBoyama verisi sağlam ✔");
