# Plan

DEHB dostu günlük plan uygulaması. Açtığında sadece **şu an ne yapman gerektiğini** tam ekran resmiyle gösterir; karar vermene gerek kalmaz.

- **Android uygulaması + web sitesi**, aynı kod, aynı veri (Supabase ile senkron).
- **Bloklar sabit, saatler esnek:** Okumanın bildirimi, resmi, ilk adımı ve odak ayarı hep aynıdır. Sadece ne zaman yapacağını değiştirirsin.
- **Bildirimler:** 5 dk önce uyarı, başlangıçta tam ekran resim, başlamazsan 3 dk'da bir tekrar, bitişte bildirim. "Başladım / Atla / Tamamladım" doğrudan bildirimden.
- **Odak modu:** Bildirimler susar; telefon ve WhatsApp aramaları gelir. Diğer uygulamaları açarsan önüne "Odak zamanı" ekranı çıkar. Sabit saat aralığı olarak (ör. gece) ya da bloğa bağlı (DSA, okuma…) çalışır.
- **Sesli odak:** Arka planda kendi müziğin döngüde çalar. Rastgele aralıklarla "Clear your mind", "They're staring at you again" gibi farkındalık cümleleri söylenir. Cümleler, aralık, ses, dil ve kendi ses kayıtların ayarlanabilir.
- **Pelvis programı:** 8 haftalık öne eğik pelvis programı, haftaya göre değişen, sayaçlı, adım adım rehber.
- **Takip:** Günlük ve haftalık uyum, bloklara göre oranlar, pelvis programı ilerlemesi.
- **Kötü gün modu:** Tek tuşla sadece temel bloklar kalır.

## Varsayılan gün

Kalkış 07:00, yatış 22:30. Plan → Şablon ekranından her şeyi değiştirebilirsin.

| Saat | Blok |
|---|---|
| 07:15 | Meditasyon (30 dk) |
| 07:45 | Pelvis egzersizi (15 dk) |
| 08:00 | Sabah yürüyüşü (45 dk) |
| 08:45 | Kahvaltı |
| 09:30 | DSA 1 (90 dk, 50/10 pomodoro) |
| 11:15 | DSA 2 (90 dk) |
| 12:45 | Öğle yemeği |
| 13:30 | Okuma 1 (60 dk) |
| 14:45 | System Design (60 dk) |
| 16:00 | AI satış uygulaması (60 dk) |
| 17:15 | Ağırlık (45 dk, Pzt-Sal-Per-Cum) |
| 18:15 | Akşam yürüyüşü (45 dk) |
| 19:00 | Akşam yemeği |
| 20:30 | Okuma 2 (60 dk) |
| 21:45 | Yarını planla (10 dk) |
| 22:30–07:00 | Gece odak modu |

## Telefona kurulum (Android)

1. GitHub'da bu repoda **Actions → Android APK** altında son çalışmayı aç. **Plan-apk** dosyasını indir. `main`'e birleştirildikten sonra **Releases → Son sürüm → Plan.apk** de olur.
2. Telefonda dosyayı aç. "Bilinmeyen uygulamalara izin ver" sorulursa izin ver.
3. Uygulamayı aç → **Ayarlar → İzinler**: listedeki her satırda "Aç"a bas ve izni ver. Uygulama kilidi için "Kullanım erişimi" ile "Diğer uygulamaların üzerinde göster" şart.
   - Android 13 ve sonrasında "Kısıtlı ayar" uyarısı çıkarsa: Ayarlar → Uygulamalar → Plan → sağ üst ⋮ → "Kısıtlı ayarlara izin ver".
4. Yeni sürümü kurarken eskisini silmene gerek yok, üzerine kur.

## Web sürümü

`main`'e her gönderimde GitHub Pages'e yayınlanır: `https://nsamarslan.github.io/Plan/`

İlk sefer için: GitHub → repo **Settings → Pages → Source: GitHub Actions**.

## Senkron kurulumu (5 dakika, ücretsiz)

1. [supabase.com](https://supabase.com) → ücretsiz hesap → **New project**.
2. **SQL Editor** → `supabase/schema.sql` dosyasının içeriğini yapıştır → **Run**. Daha önce çalıştırdıysan yeni sürümü de aynı şekilde çalıştır; tekrar çalıştırmak güvenli.
3. **Authentication → Sign In / Providers → Email**: "Confirm email" seçeneğini kapat. Böylece onay maili beklemeden giriş yaparsın.
4. **Project Settings → API**: `Project URL` ve `anon public` anahtarını kopyala.
5. İki yoldan birini seç:
   - **Kolay:** Uygulamada Ayarlar → Senkron'a yapıştır. Bunu telefonda ve web'de bir kez yap. Bu bilgi sadece o cihazda saklanır, diğer cihazın ayarlarını değiştirmez.
   - **Kalıcı:** GitHub → Settings → Secrets and variables → Actions → **Variables** sekmesine `SUPABASE_URL` ve `SUPABASE_ANON_KEY` ekle. Bundan sonraki her derleme bu bilgilerle gelir.

Sonra iki cihazda da aynı e-posta ve şifreyle giriş yap.

- Bir cihazda **Çıkış** yapmak sadece o cihazı çıkarır.
- Aynı cihazda başka bir hesaba girersen, önceki hesabın verileri yeni hesaba karışmaz; cihaz yeni hesabın verileriyle başlar.
- **Ayarlar → Veri → Bu cihazdaki her şeyi sıfırla** o cihazı senkrondan da çıkarır.

## Sesli odak

- Ayarlar → Sesli odak → **Müzik dosyaları → Dosya ekle**: kendi müziğini ekle. Tek dosya seçiliyse sonsuz döngüde çalar; kısa parçalar geçiş fark edilmeden döner.
- **Ses kayıtları**: Kendi kaydettiğin komutları ekle, cümlelerin arasında rastgele çalar.
- Cümlelerde `{block}` yazarsan o anki bloğun adıyla değişir.
- Ses dosyaları her cihazda ayrı saklanır, senkronlanmaz.

## Geliştirme

```bash
npm install
npm run dev        # web, http://localhost:5173
npm test           # plan mantığı testleri
npm run build      # web paketi (dist/)
npm run art        # resimlerden Android bildirim görselleri ve ikonlar
npm run android:apk  # Android SDK kuruluysa APK
```

Yapı:

- `src/model/`: plan mantığı (şablon → gün, kaydırma, bildirim ve odak planı, istatistik, pelvis programı). Testler `schedule.test.ts` içinde.
- `src/screens/`: Şimdi, Bugün, Plan, Takip ve Ayarlar ekranları.
- `src/audio/`: arka plan müziği, sesli komutlar, ses dosyası deposu.
- `src/store/`: yerel depolama ve Supabase senkronu.
- `android/app/src/main/java/com/nsamarslan/plan/`: alarmlar, bildirimler, Rahatsız Etmeyin, uygulama kilidi, metin okuma.
- `public/art/`: blok resimleri (SVG).
