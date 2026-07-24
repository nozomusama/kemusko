# 🎈 Kemal'in Oyunları

Kemal (3-5 yaş) için yapılmış, telefonun tarayıcısında çalışan mini oyunlar.
Kurulum gerekmez — `index.html` dosyasını herhangi bir tarayıcıda açmak yeterli.

## Oyunlar

| Oyun | Tarz | Nasıl oynanır |
|---|---|---|
| 🐍 **Yılan Kurtarma** | Bulmaca / mantık | Yılana dokun, baş yönünde kayarak labirentten çıksın. Yolu kapatan yılanları önce kurtar! Bölümler cihazda, Kemal'in seviyesine göre üretilir. |
| 🐣 **Eşleştirme** | Bulmaca / hafıza | Kartlara dokun, aynı hayvanları eşleştir. Her turda kart sayısı biraz artar. |
| 🐰 **Zıp Zıp Koşu** | Koşu / zıplama | Ekrana dokun, tavşan zıplasın! Yıldızları topla, engellerin üstünden atla. |

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
  çarpma ve yıldız sayısı

**Yılan Kurtarma** ayrıca bölümleri kademeye göre **cihazda üretir**: ilk kez
ulaşılan kademede el yapımı bölüm gösterilir, sonrasında oyun içi üretici
taze bölümler kurar ve her birini gömülü çözücüyle kanıtlayarak kabul eder.
Üreticiyi `node tools/test-yilan-generator.mjs` sınar.

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
telefonun tarayıcısından oynanabilir.

## Yapı

```
index.html                    → Ana menü
games/yilan/index.html        → Yılan Kurtarma oyunu
games/eslestirme/index.html   → Eşleştirme oyunu
games/kosu/index.html         → Zıp Zıp Koşu oyunu
tools/verify-levels.mjs       → Yılan bölümlerinin çözülebilirlik kanıtı
```

### Yılan Kurtarma bölümleri hakkında

Bölümler `games/yilan/index.html` içindeki `LEVELS` dizisinde durur. Mekanik
gereği bir yılanı kurtarmak yolları yalnızca açar; bu yüzden çözülebilir bir
bölümde çocuk hangi sırayla denerse denesin asla çıkmaza giremez. Yeni bölüm
eklerseniz `node tools/verify-levels.mjs` çalıştırarak çözülebilirliği
kanıtlayın.

Her oyun tek bir HTML dosyasıdır (bağımlılık yok), yenisini eklemek için
`games/` altına klasör açıp ana menüye buton eklemek yeterli.
