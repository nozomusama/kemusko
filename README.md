# 🎈 Kemal'in Oyunları

Kemal (3-5 yaş) için yapılmış, telefonun tarayıcısında çalışan mini oyunlar.
Kurulum gerekmez — `index.html` dosyasını herhangi bir tarayıcıda açmak yeterli.

## Oyunlar

| Oyun | Tarz | Nasıl oynanır |
|---|---|---|
| 🐍 **Yılan Kurtarma** | Bulmaca / mantık | Yılana dokun, baş yönünde kayarak labirentten çıksın. Yolu kapatan yılanları önce kurtar! Bölümler cihazda, Kemal'in seviyesine göre üretilir. |
| ➡️ **Yılanın Yolu** | Algoritma / mantık | Ok kartlarını sıraya diz, ▶️ bas, yılan adım adım yürüsün. Her adımda ilgili kart parlar — "bu ok → bu hareket". Engeller, ⭐ toplama, 🔑→🚪 bağımlılık ve 🔁 tekrar kartı kademeli açılır. |
| 🖍️ **Boyama** | Yaratıcılık / özen | Renkli kalem seç, figürün içini parmakla boya. Başta boya dışarı taşmaz; ilerledikçe taşmaya başlar ve 🧽 sünger ile temizlemen gerekir. |
| 🐣 **Eşleştirme** | Bulmaca / hafıza | Kartlara dokun, aynı hayvanları eşleştir. Her turda kart sayısı biraz artar. |
| 🐰 **Zıp Zıp Koşu** | Koşu / zıplama | Ekrana dokun, tavşan zıplasın! Yıldızları topla, engellerin üstünden atla. |

## 📷 Kamera Oyunları (dizüstü + TV)

Dizüstü bilgisayarı TV'ye bağlayıp kameranın karşısına geçerek **bütün vücutla**
oynanan oyunlar. Ana menüdeki 📷 butonundan açılır (`games/kamera/`).

| Oyun | Tarz | Nasıl oynanır |
|---|---|---|
| 🎈 **Balon Patlat** | Hareket | Ekranda kendini görürsün; balonlara elinle "dokun", patlasın! Dokunulmayan balon kızmaz — sallanıp büyür, kolaylaşır. |
| 🕺 **Dans ve Don** | Dans / özdenetim | Müzik çalarken dans et, enerji barını doldur. Müzik durunca 🧊 DON! Kıpırdarsan kardan adam güler, halka yeniden dolar — ceza yok. |
| 🤸 **Hareket Taklidi** | Taklit / denge | Soldaki çöp adamın pozunu yap (🙌 eller yukarı, ✈️ uçak, 🦩 tek ayak...). Pozu tutunca halka dolar, yıldız gelir. Kendi iskelet kuklanı da ekranda görürsün. |
| 🍎 **Ağzını Aç** | Yüz / mimik | Meyveler yukarıdan düşer; ağzını tam zamanında aç, ham! Kaçan meyve balonlanıp geri gelir. En üst kademede kocaman gülümseme bonus yıldız verir. |

Nasıl kurulur: dizüstünü TV'ye bağla, Chrome'da oyunu aç, "Kamerayı Aç"a bas
(izin sorusunu ebeveyn onaylar), çocuk kameradan 2-3 metre geriye geçsin.
Her oyun "El salla 👋" ekranıyla başlar — çocuk kendini görüp kadraja yerleşir,
3-2-1 geri sayımıyla oyun başlar.

**Gizlilik:** Kamera görüntüsü hiçbir yere gönderilmez — bütün işleme cihazın
içinde olur, kayıt tutulmaz. Balon ve Dans oyunları basit piksel-farkı
algılamayla çalışır (hiçbir kütüphane yok); Taklit ve Ağzını Aç, depoya gömülü
MediaPipe modellerini kullanır (`games/shared/vendor/mediapipe/`, Apache-2.0,
~19 MB) — internet olmadan da çalışır. Kamera erişimi tarayıcı gereği yalnızca
`http://localhost` veya HTTPS (örn. GitHub Pages) üzerinden açılır; `file://`
ile açılırsa oyun kilit ekranı 🔒 gösterir.

## Tasarım ilkeleri (3-5 yaş)

- **Okuma gerektirmez** — her şey emoji, renk ve seslerle anlatılır
- **Kaybetmek yok** — engele çarpınca oyun bitmez, tavşan sadece kısaca sersemler
- **Büyük dokunma alanları** — küçük parmaklar için her buton kocaman
- **Bol kutlama** — her başarıda konfeti, her 10 yıldızda parti modu 🎉
- **Sesler tarayıcıda üretilir** (WebAudio) — ses dosyası, internet bağlantısı, hiçbir bağımlılık yok
- **Zorluk kendini ayarlar** — her oyun Kemal'in performansına göre kolaylaşır ya da zorlaşır (aşağıya bakın)

## Uyarlanabilir zorluk ve telemetri

Tüm oyunlar ortak `games/shared/adapt.js` modülünü kullanır:

- Her oyun tur sonunda sonucu bildirir: `adapt.record({hard, smooth, ...})`
- **Zorlanılan turdan sonra kademe hemen düşer** (hüsran birikmesin);
  **üst üste iki rahat turda bir kademe çıkar** (ani zorluk sıçraması olmasın)
- Kademe ve son 300 tur telefonda saklanır (`localStorage`,
  `kemal-adapt-*` ve `kemal-telemetry-*` anahtarları) — **veri cihaz dışına
  çıkmaz**; ileriki "gelişim raporu" katmanı bu günlüğü okuyacak
- Oyun başına ölçülenler: Yılan → bölüm süresi + yanlış dokunma sayısı;
  Eşleştirme → tur süresi + yanlış çift sayısı; Koşu → 25 sn'lik pencerede
  çarpma ve yıldız sayısı; Boyama → süre + doluluk + taşma oranı + sünger sayısı;
  Yılanın Yolu → süre + deneme sayısı + çarpma + kullanılan ipucu;
  Balon Patlat → patlatma başına süre; Dans ve Don → donmadaki kıpırdama sayısı +
  dans enerjisi; Hareket Taklidi → poz başına süre + ipucu; Ağzını Aç → kaçan meyve

**Boyama** kademeleri taşma davranışını belirler: 0-1'de boya figürden dışarı
**taşamaz**, 2-3'te taşar ama kendiliğinden solar, 4-5'te kalıcı kalır ve bölümü
bitirmek için 🧽 süngerle temizlenmesi gerekir. Taşma kademe 0'da bile gizlice
ölçülür — çocuk sınır içinde kalmayı öğrenmeden üst kademeye terfi etmez.

**Yılan Kurtarma** ayrıca bölümleri kademeye göre **cihazda üretir**: ilk kez
ulaşılan kademede el yapımı bölüm gösterilir, sonrasında oyun içi üretici
taze bölümler kurar ve her birini gömülü çözücüyle kanıtlayarak kabul eder.
Üreticiyi `node tools/test-yilan-generator.mjs` sınar.

### 📊 Gelişim ve kalibrasyon raporu

Ana menünün sağ alt köşesindeki 📊 düğmesi `analiz/index.html` sayfasını açar
(ebeveynler için — çocuğa gerek yok). Sayfa yalnızca **o cihazdaki**
kayıtları okur ve gösterir:

- Oyun başına tur sayısı, güncel kademe, kademe geçmişi grafiği ve son 10
  turun metrik ortalamaları
- **Poz kalibrasyonu** (Hareket Taklidi): her poz için deneme sayısı, ortalama
  süre, ipucuyla geçme oranı ve kare kare "tam tuttu / az kaldı / kadraj dışı"
  oranları — hangi pozun eşiği sıkıysa işaretlenir
- **Kamera kalibrasyon ipuçları**: balon patlatma hızı ve hareket şiddeti,
  donma sırasındaki gürültü, ağız açıklığının eşiğe oranı — eşiklerin
  gevşetilmesi/sıkılması gerektiğinde uyarı verir

**📋 Verileri Kopyala** düğmesi bütün kayıtları JSON olarak panoya kopyalar;
birkaç oyundan sonra bu çıktıya bakılarak `TIERS`/`POSES` eşikleri gerçek
veriye göre güncellenir.

**Yeni oyun eklerken:** `<script src="../shared/adapt.js"></script>` ekleyin,
`KemalAdapt.create("<oyun>", {min, max, start, streak})` ile kademeyi alın ve
her tur sonunda `record()` çağırın — analiz ve uyarlama kendiliğinden çalışır.

## Çalıştırma

Telefonda veya bilgisayarda:

```bash
# Herhangi bir statik sunucu yeterli, örneğin:
python3 -m http.server 8000
# Sonra tarayıcıda: http://localhost:8000
```

Ya da GitHub Pages'i açarsanız (Settings → Pages → `main` branch) oyunlar doğrudan
telefonun tarayıcısından oynanabilir. Kamera oyunları tarayıcı gereği yalnızca
`http://localhost` veya HTTPS üzerinden kamera açabilir — Pages bunun için yeterli.

## Yapı

```
index.html                    → Ana menü
analiz/index.html             → Gelişim ve kalibrasyon raporu (ebeveyn sayfası)
games/shared/adapt.js         → Ortak uyarlanabilir zorluk + telemetri modülü
games/yilan/index.html        → Yılan Kurtarma oyunu
games/komut/index.html        → Yılanın Yolu (komut dizisi) oyunu
games/boyama/index.html       → Boyama oyunu
games/eslestirme/index.html   → Eşleştirme oyunu
games/kosu/index.html         → Zıp Zıp Koşu oyunu
games/shared/kamera.js        → Kamera oyunlarının ortak modülü (izin, hareket
                                algılama, ısınma ekranı, MediaPipe yükleyici)
games/shared/vendor/mediapipe/→ Gömülü MediaPipe (poz + yüz modelleri, offline)
games/kamera/index.html       → Kamera oyunları merkezi (menü)
games/kamera/balon/index.html → Balon Patlat oyunu
games/kamera/dans/index.html  → Dans ve Don oyunu
games/kamera/taklit/index.html→ Hareket Taklidi oyunu
games/kamera/agzini-ac/index.html → Ağzını Aç oyunu
tools/verify-levels.mjs       → Yılan bölümlerinin çözülebilirlik kanıtı
tools/test-yilan-generator.mjs→ Yılan oyun içi üreticisinin sınaması
tools/smoke-yilan.mjs         → Yılan uçtan uca tarayıcı testi (Playwright)
tools/test-komut-generator.mjs→ Yılanın Yolu bölüm üreticisinin denetimi
tools/smoke-komut.mjs         → Yılanın Yolu uçtan uca tarayıcı testi
tools/verify-boyama.mjs       → Boyama kademe/figür verisi denetimi
tools/smoke-boyama.mjs        → Boyama uçtan uca tarayıcı testi (Playwright)
tools/verify-kamera.mjs       → Kamera oyunları kademe/poz verisi denetimi
tools/smoke-kamera.mjs        → Kamera oyunları uçtan uca testi (sahte kamera)
```

### Yılan Kurtarma bölümleri hakkında

Bölümler `games/yilan/index.html` içindeki `LEVELS` dizisinde durur. Mekanik
gereği bir yılanı kurtarmak yolları yalnızca açar; bu yüzden çözülebilir bir
bölümde çocuk hangi sırayla denerse denesin asla çıkmaza giremez. Yeni bölüm
eklerseniz `node tools/verify-levels.mjs` çalıştırarak çözülebilirliği
kanıtlayın.

Her oyun tek bir HTML dosyasıdır (bağımlılık yok), yenisini eklemek için
`games/` altına klasör açıp ana menüye buton eklemek yeterli. Tek istisna
kamera oyunlarıdır: ortak `games/shared/kamera.js` modülünü, Taklit ve
Ağzını Aç ise ek olarak gömülü MediaPipe dosyalarını yükler — yine de her
şey depodadır, dış sunucuya bağlanılmaz.
