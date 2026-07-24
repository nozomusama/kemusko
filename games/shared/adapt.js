// Kemal'in Oyunları — cihaz üstü uyarlanabilir zorluk + yerel telemetri.
//
// Kullanım (her oyunun ana script'inden önce yüklenir):
//   <script src="../shared/adapt.js"></script>
//   var adapt = KemalAdapt.create("oyun-adi", { min: 0, max: 9, start: 0, streak: 2 });
//   adapt.level                          → mevcut zorluk kademesi
//   adapt.record({ hard: …, smooth: … }) → tur sonucunu bildir; yeni kademeyi döndürür
//
// Kural: zorlanılan (hard) turdan sonra kademe HEMEN düşer — hüsran birikmesin.
// Üst üste `streak` kez rahat (smooth) geçilirse bir kademe çıkılır — ani
// zorluk sıçraması olmasın. İkisi de değilse seri sıfırlanır, kademe kalır.
//
// Her record() çağrısı, verilen ek alanlarla birlikte yerel telemetri
// günlüğüne yazılır (localStorage, oyun başına son 300 kayıt). Veri cihaz
// dışına çıkmaz; ileride gelişim raporu katmanı bu günlüğü okuyacak.
(function () {
  "use strict";

  function load(key, def) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v == null ? def : v;
    } catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  window.KemalAdapt = {
    create: function (game, opts) {
      var stateKey = "kemal-adapt-" + game;
      var logKey = "kemal-telemetry-" + game;
      var st = load(stateKey, null);
      if (!st || typeof st.level !== "number") st = { level: opts.start || 0, streak: 0 };
      st.level = Math.max(opts.min, Math.min(opts.max, st.level));

      return {
        get level() { return st.level; },
        record: function (res) {
          var entry = {};
          for (var k in res) {
            if (Object.prototype.hasOwnProperty.call(res, k)) entry[k] = res[k];
          }
          entry.t = Date.now();
          entry.level = st.level;

          if (res.hard) {
            st.level = Math.max(opts.min, st.level - 1);
            st.streak = 0;
          } else if (res.smooth) {
            st.streak++;
            if (st.streak >= (opts.streak || 2)) {
              st.level = Math.min(opts.max, st.level + 1);
              st.streak = 0;
            }
          } else {
            st.streak = 0;
          }
          save(stateKey, st);

          entry.next = st.level;
          var log = load(logKey, []);
          log.push(entry);
          if (log.length > 300) log = log.slice(log.length - 300);
          save(logKey, log);
          return st.level;
        }
      };
    }
  };
})();
