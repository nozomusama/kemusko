// Yılan Kurtarma bölüm doğrulayıcısı.
// Kullanım: node tools/verify-levels.mjs
// games/yilan/index.html içindeki LEVELS verisini okur ve her bölümün
// kurallara uygun ve ÇÖZÜLEBİLİR olduğunu kanıtlar. Bir yılanı kurtarmak
// hücreleri yalnızca boşalttığı için açgözlü çözücü eksiksizdir: açgözlü
// çözebiliyorsa her dokunma sırası da çözebilir — çocuk asla kilitlenemez.
import { readFileSync } from "fs";

const html = readFileSync(new URL("../games/yilan/index.html", import.meta.url), "utf8");
const m = html.match(/\/\*LEVELS_START\*\/(.*?)\/\*LEVELS_END\*\//s);
if (!m) { console.error("LEVELS bloğu bulunamadı"); process.exit(1); }
const LEVELS = JSON.parse(m[1]);

const key = (x, y) => x + "," + y;
const heading = s => [s[0][0] - s[1][0], s[0][1] - s[1][1]];

function escapePath(s, W, H) {
  const [dx, dy] = heading(s);
  const cells = [];
  let [x, y] = s[0];
  x += dx; y += dy;
  while (x >= 0 && x < W && y >= 0 && y < H) { cells.push([x, y]); x += dx; y += dy; }
  return cells;
}

let fail = 0;
LEVELS.forEach((lv, li) => {
  const name = "L" + (li + 1);
  const { w: W, h: H, snakes } = lv;
  const err = msg => { console.error(`✘ ${name}: ${msg}`); fail++; };

  const occ = new Set();
  for (const s of snakes) {
    if (s.length < 3) err("yılan çok kısa: " + JSON.stringify(s));
    for (let i = 1; i < s.length; i++) {
      if (Math.abs(s[i][0] - s[i - 1][0]) + Math.abs(s[i][1] - s[i - 1][1]) !== 1)
        err("komşu olmayan hücreler: " + JSON.stringify(s));
    }
    for (const [x, y] of s) {
      if (x < 0 || x >= W || y < 0 || y >= H) err("ızgara dışı hücre");
      if (occ.has(key(x, y))) err("üst üste binen yılanlar: " + key(x, y));
      occ.add(key(x, y));
    }
    const own = new Set(s.map(([x, y]) => key(x, y)));
    if (escapePath(s, W, H).some(([x, y]) => own.has(key(x, y))))
      err("kaçış hattı kendi gövdesinden geçiyor: " + JSON.stringify(s));
  }

  let remaining = snakes.slice();
  let rounds = 0;
  while (remaining.length) {
    const occNow = new Set();
    for (const s of remaining) for (const [x, y] of s) occNow.add(key(x, y));
    const freed = remaining.filter(s => {
      const own = new Set(s.map(([x, y]) => key(x, y)));
      return escapePath(s, W, H).every(([x, y]) => !occNow.has(key(x, y)) || own.has(key(x, y)));
    });
    if (!freed.length) { err("ÇÖZÜLEMEZ bölüm!"); break; }
    remaining = remaining.filter(s => !freed.includes(s));
    rounds++;
  }
  if (remaining.length === 0)
    console.log(`✔ ${name}: ${W}x${H}, ${snakes.length} yılan, ${rounds} kurtarma dalgası`);
});

if (fail) { console.error(`\n${fail} hata bulundu`); process.exit(1); }
console.log("\nTüm bölümler çözülebilir ✔");
