# 🎈 Kemal'in Oyunları

Kemal (3-5 yaş) için yapılmış, telefonun tarayıcısında çalışan mini oyunlar.
Kurulum gerekmez — `index.html` dosyasını herhangi bir tarayıcıda açmak yeterli.

## Oyunlar

| Oyun | Tarz | Nasıl oynanır |
|---|---|---|
| 🐣 **Eşleştirme** | Bulmaca / hafıza | Kartlara dokun, aynı hayvanları eşleştir. Her turda kart sayısı biraz artar. |
| 🐰 **Zıp Zıp Koşu** | Koşu / zıplama | Ekrana dokun, tavşan zıplasın! Yıldızları topla, engellerin üstünden atla. |

## Tasarım ilkeleri (3-5 yaş)

- **Okuma gerektirmez** — her şey emoji, renk ve seslerle anlatılır
- **Kaybetmek yok** — engele çarpınca oyun bitmez, tavşan sadece kısaca sersemler
- **Büyük dokunma alanları** — küçük parmaklar için her buton kocaman
- **Bol kutlama** — her başarıda konfeti, her 10 yıldızda parti modu 🎉
- **Sesler tarayıcıda üretilir** (WebAudio) — ses dosyası, internet bağlantısı, hiçbir bağımlılık yok

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
games/eslestirme/index.html   → Eşleştirme oyunu
games/kosu/index.html         → Zıp Zıp Koşu oyunu
```

Her oyun tek bir HTML dosyasıdır (bağımlılık yok), yenisini eklemek için
`games/` altına klasör açıp ana menüye buton eklemek yeterli.
