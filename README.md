# Plan

DEHB dostu günlük plan uygulaması. Açtığında sadece **şu an ne yapman gerektiğini** tam ekran resmiyle gösterir; karar vermene gerek kalmaz.

- **Android uygulaması + web sitesi**, aynı kod, aynı veri (Supabase ile senkron).
- **Bloklar sabit, saatler esnek:** Okumanın bildirimi, resmi, ilk adımı ve odak ayarı hep aynıdır. Sadece ne zaman yapacağını değiştirirsin.
- **Bildirimler:** 5 dk önce uyarı, başlangıçta tam ekran resim, başlamazsan 3 dk'da bir tekrar, bitişte bildirim. "Başladım / +10 dk / Atla / Tamamladım" doğrudan bildirimden; "+10 dk" uygulamayı açmadan planı kaydırır (başlamadan: blok 10 dk sonraya, bitişte: blok 10 dk uzar, sonrakiler kayar).
- **Odak modu:** Bildirimler susar; telefon ve WhatsApp aramaları gelir. Diğer uygulamaları açarsan önüne "Odak zamanı" ekranı çıkar. Sabit saat aralığı olarak (ör. gece) ya da bloğa bağlı (DSA, okuma…) çalışır.
- **Sesli odak:** Arka planda kendi müziğin döngüde çalar. Rastgele aralıklarla "Clear your mind", "They're staring at you again" gibi farkındalık cümleleri söylenir. Cümleler, aralık, ses, dil ve kendi ses kayıtların ayarlanabilir.
- **Pelvis programı:** 8 haftalık öne eğik pelvis programı, haftaya göre değişen, sayaçlı, adım adım rehber.
- **Antrenman kaydı:** Ağırlık bloğunda her hareketin set satırları (kg × tekrar). Gri öneriler geçen seferden gelir (barbell'de tüm setlerde üst tekrara ulaştıysan +2.5 kg). ✓ dinlenme sayacını başlatır, süre bitince telefon çalar (ekran kapalıyken de). Dinlenme süresi ve programdaki set sayısı hareket başına hatırlanır; sadece o gün için + Set / − Set.
- **Tartı, protein, su:** Bugün ekranında tek dokunuşla (+10 g, +0,5 L). Takip ekranında kilo seyri, 7 günlük ortalama ve antrenman geçmişi.
- **Pomodoro:** Bloğun içinde odak/mola dilimleri ve kalan süre pastası; ya da plandan bağımsız, süreyi seçip hemen başlat.
- **Duraklat / devam et:** Araya iş girince sayaç durur, odak kilidi ve ses bırakır. Devam edince blok ara kadar uzar; ara çalışma süresine sayılmaz.
- **Takip:** Günlük ve haftalık uyum, bloklara göre oranlar, pelvis programı ilerlemesi. Pazar akşamı haftalık özet bildirimi (uyum + en çok kaçan blok).
- **Kötü gün / Off gün:** Kötü günde sadece temel bloklar kalır. Off günde hiç bildirim, odak kilidi ya da takip yok; seriyi de bozmaz.

## Varsayılan gün

Ekim 2026 çalışma planı (Obsidian'daki ana hub). Kalkış 06:30, yatış 23:00, 18:6 aralıklı oruç (yemek 13:00–19:00). Pazar dahil her gün aynı; dinlenmek istediğin gün Bugün → **Off**. Plan → Şablon ekranından her şeyi değiştirebilirsin.

| Saat | Blok |
|---|---|
| 06:35 | Pelvis programı (15 dk) |
| 07:00 | Algo (120 dk, 50/10 pomodoro) |
| 09:20 | Build (180 dk, 50/10) |
| 12:20 | Meditasyon (40 dk) |
| 13:00 | Öğle yemeği |
| 13:30 | Şekerleme (25 dk) |
| 14:00 | Teori (120 dk, 50/10) |
| 16:00 | Ara öğün (Pzt-Sal-Per-Cum) |
| 16:10 | Ağırlık (80 dk, Pzt-Sal-Per-Cum) |
| 17:45 | Akşam yemeği |
| 18:30 | Yürüyüş (60 dk) |
| 20:30 | Okuma (60 dk) |
| 22:00–06:30 | Gece odak modu (ekranlar kapalı) |

**Tarihe göre değişen bloklar** (`src/model/roadmap.ts`, H1 = 19 Ekim 2026, 26 hafta):

- **Algo / Build / Teori:** başlık ve "ilk adım" haftaya ve faza göre gelir. Örnekler: "Build · Modül 1-7", "AI · RAG + pgvector". Teori bloğu H1'de hep Python. Sonra Pzt/Çar/Cum System Design, Sal/Per/Paz Python; Faz 3'ten itibaren her gün SD. Cumartesi: Algo mock, haftayı kapatan commit, SD mock ya da haftalık tekrar.
- **Ağırlık:** Pzt Upper A, Sal Lower A, Per Upper B, Cum Lower B; hareket listesi ekranda. 1 Kasım'a kadar her harekette 1 set eksik.
- Şimdi ekranında bloğun altında o haftanın faz bilgisi ve konuları görünür.
- **Kötü gün:** pelvis, 60 dk algo (sadece tekrarlar), 60 dk build, yemekler, şekerleme, 30 dk yürüyüş.

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
