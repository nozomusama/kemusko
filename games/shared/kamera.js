// Kemal'in Oyunları — kamera oyunlarının paylaşılan modülü.
//
// Kullanım (games/kamera/<oyun>/index.html içinden):
//   <script src="../../shared/kamera.js"></script>
//   KemalKamera.start().then(function (cam) {
//     var motion = KemalKamera.createMotion(cam.video);
//     KemalKamera.warmup(cam.video, motion, { beep: beep }).then(oyunuBaslat);
//   });
//
// Sağladıkları:
//   start()        → kamera izni + dost canlısı izin/hata ekranları; aynalı <video>
//   createMotion() → kütüphanesiz piksel-farkı hareket ızgarası (ML gerekmez)
//   warmup()       → "El salla 👋" kadraj kontrolü + 3-2-1 geri sayım
//   loadPose()/loadFace() → gömülü MediaPipe (games/shared/vendor/mediapipe/)
//   sleep()        → "robot uykuda 😴" ekranı (model yüklenemezse; asla boş sayfa yok)
//   cover()        → video karesi (0..1) ↔ ekran pikseli dönüşümü (object-fit: cover)
//   landmarks      → poz noktalarını adlandırıp AYNALAYAN yardımcılar
//
// Ayna kuralı: video CSS ile aynalanır (scaleX(-1)); hareket hücreleri ve
// poz noktaları da BURADA çevrilir. Oyun kodu hiçbir şeyi kendisi çevirmez —
// bütün koordinatlar ekranda görünenle aynıdır (0 = ekranın solu).
//
// Görüntü hiçbir yere gönderilmez: bütün işleme bu cihazın içinde olur.
(function () {
  "use strict";

  // kamera.js'in bulunduğu klasör → vendor yolu buradan türetilir
  var BASE = (function () {
    var src = (document.currentScript && document.currentScript.src) || "";
    return src.slice(0, src.lastIndexOf("/") + 1);
  })();
  var VENDOR = BASE + "vendor/mediapipe/";

  // --- Ortak stil (bir kez enjekte edilir) ---
  var styled = false;
  function ensureStyles() {
    if (styled) return;
    styled = true;
    var css = "" +
      ".kk-video { position: fixed; inset: 0; width: 100%; height: 100%;" +
      "  object-fit: cover; transform: scaleX(-1); z-index: 0; background: #222; }" +
      ".kk-overlay { position: fixed; inset: 0; z-index: 50; display: flex;" +
      "  flex-direction: column; align-items: center; justify-content: center;" +
      "  gap: 4vh; background: linear-gradient(160deg, #7ec8ff 0%, #b3e5fc 45%, #aef3b0 100%); }" +
      ".kk-overlay.kk-clear { background: rgba(0,0,0,.18); }" +
      ".kk-big { font-size: clamp(90px, 22vh, 220px); line-height: 1;" +
      "  text-shadow: 0 4px 24px rgba(0,0,0,.35); animation: kk-bounce .7s infinite alternate; }" +
      "@keyframes kk-bounce { from { transform: scale(1); } to { transform: scale(1.15); } }" +
      ".kk-row { display: flex; gap: 3vw; align-items: center; }" +
      ".kk-btn { font-family: inherit; font-size: clamp(26px, 6vh, 56px); font-weight: bold;" +
      "  color: #444; background: #fff; border: 6px solid #ffb300; border-radius: 28px;" +
      "  padding: 2vh 5vw; box-shadow: 0 8px 0 rgba(0,0,0,.12); cursor: pointer;" +
      "  text-decoration: none; display: flex; align-items: center; gap: 1.5vw; }" +
      ".kk-btn:active { transform: scale(.95) translateY(4px); box-shadow: 0 3px 0 rgba(0,0,0,.12); }" +
      ".kk-home { position: fixed; top: 2vh; left: 2vh; text-decoration: none;" +
      "  font-size: clamp(28px, 6vh, 44px); background: #fff; border-radius: 50%;" +
      "  width: clamp(52px, 11vh, 76px); height: clamp(52px, 11vh, 76px); display: flex;" +
      "  align-items: center; justify-content: center; box-shadow: 0 5px 0 rgba(0,0,0,.15); z-index: 60; }" +
      ".kk-home:active { transform: translateY(3px); box-shadow: 0 2px 0 rgba(0,0,0,.15); }" +
      ".kk-rotate { position: fixed; inset: 0; z-index: 90; display: none;" +
      "  align-items: center; justify-content: center; font-size: clamp(80px, 24vh, 200px);" +
      "  background: linear-gradient(160deg, #7ec8ff 0%, #aef3b0 100%); }" +
      "@media (orientation: portrait) { .kk-rotate { display: flex; } }";
    var el = document.createElement("style");
    el.textContent = css;
    document.head.appendChild(el);
  }

  // --- Tek ekranlı durum arayüzü (izin, hata, ısınma, uyku) ---
  var overlay = null;
  function screen(o) {
    ensureStyles();
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "kk-overlay";
      document.body.appendChild(overlay);
    }
    overlay.style.display = "flex";
    overlay.classList.toggle("kk-clear", !!o.transparent);
    overlay.innerHTML = "";

    var big = document.createElement("div");
    big.className = "kk-big";
    big.textContent = o.emoji || "";
    overlay.appendChild(big);

    var row = document.createElement("div");
    row.className = "kk-row";
    overlay.appendChild(row);
    (o.buttons || []).forEach(function (b) {
      var el;
      if (b.href) {
        el = document.createElement("a");
        el.href = b.href;
      } else {
        el = document.createElement("button");
        el.type = "button";
        el.addEventListener("click", function () { if (b.onTap) b.onTap(); });
      }
      el.className = "kk-btn";
      el.textContent = b.text;
      row.appendChild(el);
    });

    if (o.home !== false) {
      var home = document.createElement("a");
      home.className = "kk-home";
      home.href = o.homeHref || "../index.html";
      home.textContent = "🏠";
      overlay.appendChild(home);
    }
    return big;   // geri sayım gibi durumlarda emoji değiştirilebilsin
  }
  function hideScreen() {
    if (overlay) overlay.style.display = "none";
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error("kamera-zaman-asimi")); }, ms);
      promise.then(
        function (v) { clearTimeout(t); resolve(v); },
        function (e) { clearTimeout(t); reject(e); }
      );
    });
  }

  // --- Kamera edinme ---
  function start(opts) {
    opts = opts || {};
    ensureStyles();
    // Dikey ekran ipucu (oyunlar yatay tasarlandı): CSS medya sorgusu gösterir
    if (!document.querySelector(".kk-rotate")) {
      var rot = document.createElement("div");
      rot.className = "kk-rotate";
      rot.textContent = "🔄💻";
      document.body.appendChild(rot);
    }

    return new Promise(function (resolve) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Güvenli bağlam yok (file:// vb.) — kamera hiç açılamaz
        screen({ emoji: "🔒📷", homeHref: opts.homeHref });
        return;
      }

      function ask() {
        screen({
          emoji: "📷",
          buttons: [{ text: "Kamerayı Aç", onTap: request }],
          homeHref: opts.homeHref
        });
      }

      function request() {
        screen({ emoji: "📷", homeHref: opts.homeHref });
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        }).then(function (stream) {
          var video = document.createElement("video");
          video.className = "kk-video";
          video.setAttribute("playsinline", "");
          video.muted = true;
          video.autoplay = true;
          video.srcObject = stream;
          document.body.insertBefore(video, document.body.firstChild);

          function ready() {
            if (!video.videoWidth) { setTimeout(ready, 60); return; }
            hideScreen();
            resolve({
              video: video,
              stream: stream,
              stop: function () {
                stream.getTracks().forEach(function (t) { t.stop(); });
                video.remove();
              }
            });
          }
          var p = video.play();
          if (p && p.catch) p.catch(function () {});
          ready();
        }).catch(function (err) {
          var denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
          screen({
            emoji: denied ? "🙈📷" : "🚫📷",
            buttons: [{ text: "🔁", onTap: request }],
            homeHref: opts.homeHref
          });
        });
      }

      ask();
    });
  }

  // --- Piksel-farkı hareket ızgarası (ML gerekmez) ---
  // Kare 96x54'e küçültülür, gri tona çevrilir, önceki kareyle piksel piksel
  // karşılaştırılır. Hücre değeri = o hücrede değişen piksel oranı (0..1).
  // Hücreler AYNALI saklanır: hücre sütun 0 = ekranın solu.
  function createMotion(video, opts) {
    opts = opts || {};
    var cols = opts.cols || 16, rows = opts.rows || 9;
    var SW = 96, SH = 54;
    var fps = opts.fps || 15;
    var threshold = opts.threshold || 26;

    var cv = document.createElement("canvas");
    cv.width = SW; cv.height = SH;
    var cx = cv.getContext("2d", { willReadFrequently: true });

    var cur = new Uint8ClampedArray(SW * SH);
    var prev = new Uint8ClampedArray(SW * SH);
    var havePrev = false;
    var counts = new Uint16Array(cols * rows);
    var lastSample = 0;

    var m = {
      cols: cols,
      rows: rows,
      cells: new Float32Array(cols * rows),
      global: 0
    };

    m.sample = function (now) {
      if (now - lastSample < 1000 / fps) return false;
      if (!video.videoWidth) return false;
      lastSample = now;

      cx.drawImage(video, 0, 0, SW, SH);
      var data;
      try { data = cx.getImageData(0, 0, SW, SH).data; }
      catch (e) { return false; }

      for (var i = 0, j = 0; j < SW * SH; i += 4, j++) {
        cur[j] = (data[i] * 3 + data[i + 1] * 4 + data[i + 2]) >> 3;
      }

      if (havePrev) {
        counts.fill(0);
        var changed = 0;
        for (var y = 0; y < SH; y++) {
          var cy = ((y * rows / SH) | 0) * cols;
          for (var x = 0; x < SW; x++) {
            var k = y * SW + x;
            var d = cur[k] - prev[k];
            if (d < 0) d = -d;
            if (d > threshold) {
              changed++;
              // ayna: küçük karedeki sütun, ekranda sağdan sola sayılır
              counts[cy + (cols - 1 - ((x * cols / SW) | 0))]++;
            }
          }
        }
        var perCell = (SW / cols) * (SH / rows);
        for (var c = 0; c < counts.length; c++) {
          // hafif yumuşatma: ani tek karelik parlamalar hücreyi zıplatmasın
          m.cells[c] += (counts[c] / perCell - m.cells[c]) * 0.5;
        }
        var raw = Math.min(1, changed / (SW * SH) * 5);
        m.global += (raw - m.global) * 0.35;   // ~300 ms EMA (15 Hz'de)
      }

      var tmp = prev; prev = cur; cur = tmp;
      havePrev = true;
      return true;
    };

    // Ekranda görünen (aynalı) normalize koordinatta, r yarıçaplı dairedeki
    // en yüksek hücre etkinliği. x01/y01 video karesine göre 0..1; r01 dikey
    // (y) biriminde verilir — x farkı en-boy oranıyla ölçeklenir ki daire
    // ekranda da daire olsun.
    m.activityAt = function (x01, y01, r01) {
      var aspect = video.videoWidth ? video.videoWidth / video.videoHeight : 16 / 9;
      var best = 0;
      for (var ry = 0; ry < rows; ry++) {
        for (var rx = 0; rx < cols; rx++) {
          var dx = ((rx + 0.5) / cols - x01) * aspect;
          var dy = (ry + 0.5) / rows - y01;
          if (dx * dx + dy * dy <= r01 * r01) {
            var v = m.cells[ry * cols + rx];
            if (v > best) best = v;
          }
        }
      }
      return best;
    };

    return m;
  }

  // --- Isınma: "kendini görüyor musun? el salla!" + 3-2-1 ---
  function warmup(video, motion, opts) {
    opts = opts || {};
    var beep = opts.beep || function () {};
    return new Promise(function (resolve) {
      var done = false;
      var raf = 0;
      var held = 0;
      var last = performance.now();

      var big = screen({
        emoji: "👋",
        transparent: true,
        buttons: [{ text: "▶️", onTap: finish }],
        home: false
      });

      function finish() {
        if (done) return;
        done = true;
        KemalKamera._skipWarmup = null;
        cancelAnimationFrame(raf);
        hideScreen();
        resolve();
      }
      KemalKamera._skipWarmup = finish;   // testler ve ebeveyn kısayolu

      function countdown() {
        cancelAnimationFrame(raf);
        big.textContent = "✅";
        beep(660, 0.15, "sine");
        ["3️⃣", "2️⃣", "1️⃣"].forEach(function (n, i) {
          setTimeout(function () {
            if (done) return;
            big.textContent = n;
            beep(440 + i * 180, 0.15, "sine");
          }, 500 + i * 650);
        });
        setTimeout(function () {
          beep(880, 0.3, "sine");
          finish();
        }, 500 + 3 * 650);
      }

      function tick(now) {
        if (done) return;
        motion.sample(now);
        var dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        if (motion.global > 0.12) held += dt;
        else held = Math.max(0, held - dt * 0.5);
        if (held >= 1.2) { countdown(); return; }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    });
  }

  // --- MediaPipe yükleyiciler (gömülü kopyadan, tembel + önbellekli) ---
  var visionP = null;
  function loadVision() {
    if (!visionP) {
      visionP = withTimeout(import(VENDOR + "vision_bundle.js"), 20000)
        .then(function (mod) {
          return withTimeout(mod.FilesetResolver.forVisionTasks(VENDOR + "wasm"), 20000)
            .then(function (files) { return { mod: mod, files: files }; });
        });
      visionP.catch(function () { visionP = null; });   // tekrar denenebilsin
    }
    return visionP;
  }

  function makeLandmarker(kind) {
    return loadVision().then(function (v) {
      var Cls = kind === "pose" ? v.mod.PoseLandmarker : v.mod.FaceLandmarker;
      var model = kind === "pose" ? "pose_landmarker_lite.task" : "face_landmarker.task";
      function create(delegate) {
        var o = {
          baseOptions: { modelAssetPath: VENDOR + model, delegate: delegate },
          runningMode: "VIDEO"
        };
        if (kind === "pose") o.numPoses = 1;
        else { o.numFaces = 1; o.outputFaceBlendshapes = true; }
        return withTimeout(Cls.createFromOptions(v.files, o), 20000);
      }
      // GPU açılmazsa (başsız test, eski sürücü) CPU ile bir kez daha dene
      return create("GPU").catch(function () { return create("CPU"); });
    });
  }

  var poseP = null, faceP = null;
  function loadPose() {
    if (!poseP) { poseP = makeLandmarker("pose"); poseP.catch(function () { poseP = null; }); }
    return poseP;
  }
  function loadFace() {
    if (!faceP) { faceP = makeLandmarker("face"); faceP.catch(function () { faceP = null; }); }
    return faceP;
  }

  // --- "Robot uykuda" ekranı: model yüklenemedi, ML'siz oyunlara kısayol ---
  function sleep(opts) {
    opts = opts || {};
    screen({
      emoji: "😴🤖",
      buttons: [
        { text: "🔁", onTap: opts.onRetry || function () { location.reload(); } },
        { text: "🎈", href: "../balon/index.html" },
        { text: "🕺", href: "../dans/index.html" }
      ],
      homeHref: opts.homeHref
    });
  }

  // --- object-fit: cover dönüşümü ---
  // Video karesi ekranı kaplarken kenarlardan kırpılır; oyunlar nesneleri
  // video koordinatında (0..1) tutar, çizerken ekran pikseline çevirir.
  function cover(video, W, H) {
    var vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
    var s = Math.max(W / vw, H / vh);
    var dw = vw * s, dh = vh * s;
    var ox = (W - dw) / 2, oy = (H - dh) / 2;
    return {
      sx: function (x01) { return ox + x01 * dw; },
      sy: function (y01) { return oy + y01 * dh; },
      vx: function (px) { return (px - ox) / dw; },
      vy: function (px) { return (px - oy) / dh; },
      scale: s
    };
  }

  // --- Poz noktası yardımcıları ---
  var POSE_IDX = {
    nose: 0,
    lShoulder: 11, rShoulder: 12,
    lElbow: 13, rElbow: 14,
    lWrist: 15, rWrist: 16,
    lHip: 23, rHip: 24,
    lKnee: 25, rKnee: 26,
    lAnkle: 27, rAnkle: 28
  };
  var landmarks = {
    POSE_IDX: POSE_IDX,
    // MediaPipe noktalarını adlandırır ve x'i AYNALAR (ekranla örtüşsün)
    named: function (lmArr) {
      var out = {};
      for (var name in POSE_IDX) {
        var p = lmArr[POSE_IDX[name]];
        out[name] = {
          x: 1 - p.x,
          y: p.y,
          v: p.visibility == null ? 1 : p.visibility
        };
      }
      return out;
    },
    dist: function (a, b) {
      var dx = a.x - b.x, dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    },
    // b köşesindeki açı (derece)
    angle: function (a, b, c) {
      var v1x = a.x - b.x, v1y = a.y - b.y;
      var v2x = c.x - b.x, v2y = c.y - b.y;
      var dot = v1x * v2x + v1y * v2y;
      var m = Math.sqrt((v1x * v1x + v1y * v1y) * (v2x * v2x + v2y * v2y));
      if (!m) return 0;
      return Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180 / Math.PI;
    }
  };

  var KemalKamera = {
    start: start,
    createMotion: createMotion,
    warmup: warmup,
    loadPose: loadPose,
    loadFace: loadFace,
    sleep: sleep,
    cover: cover,
    landmarks: landmarks,
    _skipWarmup: null,
    _screen: screen,
    _hideScreen: hideScreen
  };
  window.KemalKamera = KemalKamera;
})();
