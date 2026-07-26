// Kamera oyunlarının kademe (TIERS) ve poz (POSES) verisini, kalıp
// tutarlılığını ve gömülü MediaPipe dosyalarını denetler.
// Kullanım: node tools/verify-kamera.mjs
import { readFileSync, statSync } from "fs";

let fail = 0;
const ok = (m) => console.log("✔ " + m);
const err = (m) => { console.error("✘ " + m); fail++; };

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

// --- Ortak kalıp denetimi ---
function checkGame(name, html, adaptKey) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (!scripts.length) err(`${name}: script bloğu bulunamadı`);
  scripts.forEach((m, i) => {
    try { new Function(m[1]); } catch (e) { err(`${name}: script #${i} sözdizimi: ${e.message}`); }
  });
  if (!html.includes('src="../../shared/adapt.js"')) err(`${name}: adapt.js dahil edilmemiş`);
  if (!html.includes('src="../../shared/kamera.js"')) err(`${name}: kamera.js dahil edilmemiş`);
  if (!html.includes(`KemalAdapt.create("${adaptKey}"`)) err(`${name}: KemalAdapt.create("${adaptKey}") yok`);
  if (!html.includes("__kameraDebug")) err(`${name}: test kancası yok`);
  if (!html.includes("KemalKamera.warmup")) err(`${name}: ısınma ekranı çağrılmıyor`);
  const tm = html.match(/\/\*TIERS_START\*\/([\s\S]*?)\/\*TIERS_END\*\//);
  if (!tm) { err(`${name}: TIERS bloğu yok`); return null; }
  try { return JSON.parse(tm[1]); }
  catch (e) { err(`${name}: TIERS JSON değil: ${e.message}`); return null; }
}

// --- 🎈 Balon ---
{
  const html = read("games/kamera/balon/index.html");
  const T = checkGame("balon", html, "kamera-balon");
  if (T) {
    if (T.length < 4) err("balon: en az 4 kademe olmalı");
    T.forEach((t, i) => {
      if (!(t.balon >= 1 && t.balon <= 6)) err(`balon kademe ${i}: balon sayısı aralık dışı`);
      if (!(t.boy > 0.05 && t.boy <= 0.5)) err(`balon kademe ${i}: boy aralık dışı`);
      if (!(t.esik > 0 && t.esik < 1)) err(`balon kademe ${i}: esik aralık dışı`);
      if (!(t.hiz >= 0)) err(`balon kademe ${i}: hiz negatif`);
      if (i > 0 && t.boy > T[i - 1].boy) err(`balon kademe ${i}: balonlar büyüyor (kolaylaşıyor)`);
      if (i > 0 && t.hedef < T[i - 1].hedef) err(`balon kademe ${i}: hedef geriliyor`);
    });
    ok(`balon TIERS: ${T.length} kademe`);
  }
}

// --- 🕺 Dans ---
{
  const html = read("games/kamera/dans/index.html");
  const T = checkGame("dans", html, "kamera-dans");
  if (T) {
    if (T.length < 4) err("dans: en az 4 kademe olmalı");
    T.forEach((t, i) => {
      if (!(t.donma >= 1 && t.donma <= 8)) err(`dans kademe ${i}: donma aralık dışı`);
      if (!(t.esik > 0 && t.esik < 1)) err(`dans kademe ${i}: esik aralık dışı`);
      if (!(t.dansMin <= t.dansMax)) err(`dans kademe ${i}: dansMin > dansMax`);
      if (!(t.bpm >= 60 && t.bpm <= 200)) err(`dans kademe ${i}: bpm aralık dışı`);
      if (i > 0 && t.donma < T[i - 1].donma) err(`dans kademe ${i}: donma süresi geriliyor`);
      if (i > 0 && t.esik > T[i - 1].esik) err(`dans kademe ${i}: esik gevşiyor (kolaylaşıyor)`);
    });
    ok(`dans TIERS: ${T.length} kademe`);
  }
}

// --- 🤸 Taklit ---
{
  const html = read("games/kamera/taklit/index.html");
  const T = checkGame("taklit", html, "kamera-taklit");
  const pm = html.match(/\/\*POSES_START\*\/([\s\S]*?)\/\*POSES_END\*\//);
  let maxHavuz = -1;
  if (!pm) err("taklit: POSES bloğu yok");
  else {
    let POSES;
    try {
      // check fonksiyonları window.KemalKamera'ya dokunur; derleme için sahte ver
      POSES = new Function("window", "return " + pm[1])({ KemalKamera: { landmarks: { dist: () => 0 } } });
    } catch (e) { err(`taklit: POSES derlenemedi: ${e.message}`); }
    if (POSES) {
      const ids = new Set();
      const JOINTS = ["head","neck","lSho","rSho","lElb","rElb","lWri","rWri","hipC","lHip","rHip","lKne","rKne","lAnk","rAnk"];
      const byHavuz = {};
      POSES.forEach((p, i) => {
        if (!p.id) err(`poz ${i}: id yok`);
        if (ids.has(p.id)) err(`poz ${i}: tekrarlanan id "${p.id}"`);
        ids.add(p.id);
        if (!p.emoji) err(`poz ${p.id}: emoji yok`);
        if (typeof p.check !== "function") err(`poz ${p.id}: check fonksiyonu yok`);
        if (!Array.isArray(p.gerek) || !p.gerek.length) err(`poz ${p.id}: gerek listesi yok`);
        if (!p.fig) err(`poz ${p.id}: fig (çöp adam) yok`);
        else JOINTS.forEach((j) => {
          const pt = p.fig[j];
          if (!pt || !(pt[0] >= 0 && pt[0] <= 1 && pt[1] >= 0 && pt[1] <= 1)) err(`poz ${p.id}: fig.${j} eksik/aralık dışı`);
        });
        if (!(p.havuz >= 0 && p.havuz <= 2)) err(`poz ${p.id}: havuz aralık dışı`);
        byHavuz[p.havuz] = (byHavuz[p.havuz] || 0) + 1;
        if (p.havuz > maxHavuz) maxHavuz = p.havuz;
      });
      for (const h of [0, 1, 2]) {
        if (!byHavuz[h]) err(`havuz ${h} boş — o kademede seçilecek poz yok`);
      }
      ok(`taklit POSES: ${POSES.length} poz (havuzlar: ${JSON.stringify(byHavuz)})`);
    }
  }
  if (T) {
    if (T.length < 4) err("taklit: en az 4 kademe olmalı");
    T.forEach((t, i) => {
      if (!(t.tutma >= 300 && t.tutma <= 4000)) err(`taklit kademe ${i}: tutma aralık dışı`);
      if (maxHavuz >= 0 && t.havuz > maxHavuz) err(`taklit kademe ${i}: havuz ${t.havuz} için poz yok`);
      if (i > 0 && t.tutma < T[i - 1].tutma) err(`taklit kademe ${i}: tutma geriliyor`);
      if (i > 0 && t.havuz < T[i - 1].havuz) err(`taklit kademe ${i}: havuz daralıyor`);
    });
    ok(`taklit TIERS: ${T.length} kademe`);
  }
}

// --- 🍎 Ağzını Aç ---
{
  const html = read("games/kamera/agzini-ac/index.html");
  const T = checkGame("agzini-ac", html, "kamera-agzini-ac");
  if (T) {
    if (T.length < 4) err("agzini-ac: en az 4 kademe olmalı");
    T.forEach((t, i) => {
      if (!["oto", "kafa"].includes(t.nisan)) err(`agzini-ac kademe ${i}: geçersiz nisan="${t.nisan}"`);
      if (!(t.agiz > 0 && t.agiz < 1)) err(`agzini-ac kademe ${i}: agiz aralık dışı`);
      if (!(t.ayni >= 1 && t.ayni <= 4)) err(`agzini-ac kademe ${i}: ayni aralık dışı`);
      if (i > 0 && t.hiz < T[i - 1].hiz) err(`agzini-ac kademe ${i}: hiz geriliyor`);
      if (i > 0 && t.hedef < T[i - 1].hedef) err(`agzini-ac kademe ${i}: hedef geriliyor`);
    });
    // "oto" nişan "kafa"dan sonra dönmemeli (kolaylaşma)
    let kafaGoruldu = false;
    T.forEach((t, i) => {
      if (t.nisan === "kafa") kafaGoruldu = true;
      else if (kafaGoruldu) err(`agzini-ac kademe ${i}: nisan "oto"ya geri dönüyor`);
    });
    ok(`agzini-ac TIERS: ${T.length} kademe`);
  }
}

// --- Merkez ve ana menü bağlantıları ---
{
  const hub = read("games/kamera/index.html");
  for (const g of ["balon", "dans", "taklit", "agzini-ac"]) {
    if (!hub.includes(`href="${g}/index.html"`)) err(`merkez: ${g} bağlantısı yok`);
  }
  if (!hub.includes('href="../../index.html"')) err("merkez: ana menü (🏠) bağlantısı yok");
  const menu = read("index.html");
  if (!menu.includes('href="games/kamera/index.html"')) err("ana menü: kamera merkezi bağlantısı yok");
  ok("merkez ve ana menü bağlantıları tamam");
}

// --- kamera.js sözdizimi ---
{
  const js = read("games/shared/kamera.js");
  try { new Function(js); ok("kamera.js sözdizimi geçerli"); }
  catch (e) { err(`kamera.js sözdizimi: ${e.message}`); }
  if (!js.includes("scaleX(-1)")) err("kamera.js: video aynalanmıyor");
}

// --- Gömülü MediaPipe dosyaları (bozuk indirme / LFS bozulmasına karşı) ---
{
  const MIN_SIZES = {
    "games/shared/vendor/mediapipe/vision_bundle.js": 100_000,
    "games/shared/vendor/mediapipe/wasm/vision_wasm_internal.js": 100_000,
    "games/shared/vendor/mediapipe/wasm/vision_wasm_internal.wasm": 5_000_000,
    "games/shared/vendor/mediapipe/pose_landmarker_lite.task": 4_000_000,
    "games/shared/vendor/mediapipe/face_landmarker.task": 2_000_000,
  };
  for (const [p, min] of Object.entries(MIN_SIZES)) {
    try {
      const s = statSync(new URL("../" + p, import.meta.url));
      if (s.size < min) err(`${p}: ${s.size} bayt — beklenenden küçük (bozuk indirme?)`);
    } catch (e) { err(`${p}: dosya yok`); }
  }
  ok("gömülü MediaPipe dosyaları yerinde");
}

if (fail) { console.error(`\n${fail} hata`); process.exit(1); }
console.log("\nKamera oyunları verisi sağlam ✔");
