# 🤖 n8n Otomasyon Koleksiyonu

n8n ile geliştirilmiş, gerçek dünya iş akışlarını otomatikleştiren **iş akışı (workflow)
otomasyonları** koleksiyonu. Telegram botları, yapay zeka ajanları (AI Agent), API
entegrasyonları, web scraping ve zamanlanmış görevleri kapsar.

> Her `.json` dosyası, n8n'e doğrudan içe aktarılabilen (Import from File) bir
> iş akışıdır.

---

## ⭐ Öne Çıkan Proje: AI Emlak Asistanı

**Telegram üzerinden sesli ve yazılı komutları anlayan yapay zeka destekli emlak
asistanı.** Modern bir **AI Agent** mimarisi kullanır: dil modeli, araç (tool) çağırma
ve konuşma hafızasını birleştirir.

**Mimari & Yetenekler:**
- 💬 **Telegram** ile çift yönlü iletişim (metin **ve** sesli mesaj)
- 🎙️ **Ses → Metin** dönüşümü (OpenAI Whisper) — sesli mesajları anlar
- 🧠 **AI Agent** (OpenAI Chat Model + LangChain) + **konuşma hafızası** (Window Buffer Memory)
- 🛠️ **Araç çağırma (tool calling):**
  - **Google Sheets (CRM):** müşteri kaydı okuma/yazma
  - **Google Calendar:** randevu/görüşme oluşturma · güncelleme · silme · listeleme
- 🔄 Niyet (intent) algılama → uygun aracı otomatik seçip işlemi tamamlar

**Akış:** Müşteri Telegram'dan yazar/konuşur → ses metne çevrilir → AI Agent niyeti
anlar → CRM'i günceller veya takvime randevu ekler → kullanıcıya doğal dilde yanıt verir.

📂 `Emlakçı Otomasyonu (1).json` &nbsp;·&nbsp; 📹 *Demo videosu: (buraya ekleyin)*

---

## 📦 Tüm İş Akışları

| Proje | Açıklama | Entegrasyonlar |
|---|---|---|
| **AI Emlak Asistanı** | Sesli/yazılı, takvim + CRM yöneten AI agent | Telegram, OpenAI, Whisper, Google Calendar/Sheets |
| **AI Galeri Asistanı** | Oto galeri için konuşma hafızalı AI satış asistanı | Telegram, OpenAI (Agent), Google Sheets |
| **Sahibinden İlan Takip** | Komut tabanlı ilan izleme/scraping botu (33 düğüm) | Telegram, HTTP, Google Sheets, Schedule |
| **AI İş Avcısı** | İnteraktif sektör seçimli iş ilanı tarama botu | Telegram, HTTP, Google Sheets, Schedule |
| **Marka & Rakip İstihbarat** | Marka/rakip izleme ve raporlama sistemi | Telegram, HTTP, Google Sheets, Schedule |
| **Omnichannel Operasyon Merkezi** | Webhook tabanlı çok kanallı operasyon akışı | Webhook, Telegram, Google Sheets |
| **Akıllı Belge İşleyici (OCR)** | Telegram'dan gelen belgeleri AI/OCR ile işler | Telegram, HTTP (OCR), Google Sheets |
| **Akıllı Anket Tarayıcı (OCR)** | Form ile yüklenen anketleri OCR ile dijitalleştirir | Form, HTTP (OCR), Google Sheets |
| **Müşteri Yorum Takip** | Yorumları izleyip analiz eden takip sistemi | HTTP, Google Sheets, Telegram, Schedule |
| **Döviz Kuru Takip & Uyarı** | Belirli eşikte Telegram uyarısı veren kur botu | HTTP, Google Sheets, Telegram, Schedule |
| **Hava Durumu Uyarı Botu** | Zamanlanmış hava durumu bildirim botu | HTTP, Telegram, Schedule |

---

## 🧰 Kullanılan Teknolojiler & Beceriler

- **n8n** iş akışı otomasyonu (workflow automation)
- **Yapay Zeka:** OpenAI (Chat + Whisper), LangChain AI Agent, tool calling, memory
- **Entegrasyonlar:** Telegram Bot API, Google Sheets, Google Calendar, Webhook'lar
- **REST API** tüketimi (HTTP Request), JSON veri işleme
- **Zamanlanmış görevler** (Schedule Trigger), koşullu mantık, web scraping
- **JavaScript** (Code/Function düğümleri ile özel mantık)

---

## 🚀 Kurulum

1. [n8n](https://n8n.io) kurun (self-hosted veya bulut).
2. n8n arayüzünde **Workflows → Import from File** ile istediğiniz `.json`'u içe aktarın.
3. İlgili **credential**'ları tanımlayın (Telegram Bot Token, OpenAI API Key, Google OAuth).
4. Workflow'u **Activate** edin.

> Not: API anahtarları ve token'lar n8n'in credential yöneticisinde tutulur; JSON
> dosyalarına gömülmez.
