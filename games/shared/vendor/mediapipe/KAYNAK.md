# MediaPipe Tasks Vision — gömülü kopya

Kamera oyunlarının poz ve yüz algılaması için kullanılır. Tüm işleme cihazda
yapılır; bu dosyalar sayesinde internet bağlantısı ve CDN gerekmez.

Sürüm: `@mediapipe/tasks-vision@0.10.14` (Apache-2.0 — bkz. LICENSE)

| Dosya | Kaynak | SHA-256 |
|---|---|---|
| `vision_bundle.js` | npm paketi `vision_bundle.mjs` (`.js` olarak yeniden adlandırıldı; `python3 -m http.server` `.mjs`'i yanlış MIME ile sunuyor) | `e77f281f9619150d937023c355bae170e9120e3b9e43f1e23a2a7bee07197669` |
| `wasm/vision_wasm_internal.js` | npm paketi | `9440cf0cc0cea21800e31581ec32aeedcc5fbf9df4509796bbc7d3f99e52ab9c` |
| `wasm/vision_wasm_internal.wasm` | npm paketi | `f82a8e6c05e08a44cc9f9e7ec5f845935bcbb1b1500ebe8c2f4812fb4e2917dc` |
| `pose_landmarker_lite.task` | storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/ | `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a` |
| `face_landmarker.task` | storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/ | `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff` |

Not: `nosimd` wasm çifti bilerek alınmadı — 2021 sonrası tüm Chrome sürümleri
WASM SIMD destekler ve oyunlar dizüstü Chrome hedefler (~9 MB tasarruf).
