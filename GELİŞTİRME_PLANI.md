# AI Agent RAG Entegrasyonu Geliştirme Planı

## 1. Amaç ve Özet

Bu doküman, mevcut AI Agent'ın DOM etkileşim modelini, verimsiz olan "tüm DOM'u LLM'e gönderme" (brute-force) yaklaşımından, modern ve verimli bir **Retrieval-Augmented Generation (RAG)** tabanlı mimariye geçirme stratejisini ve teknik adımlarını özetlemektedir.

**Hedef:** AI Agent'ın sayfa elementlerini anlama ve onlarla etkileşim kurma sürecini daha **hızlı**, daha **doğru** ve daha **düşük maliyetli** hale getirmek. Bu, kullanıcı deneyimini iyileştirecek ve operasyonel verimliliği artıracaktır.

## 2. Mevcut Mimarinin Analizi

*   **Çalışma Prensibi:** Sistem, bir eylem komutu aldığında o anki sayfanın tüm DOM ağacını metin olarak işler ve bu devasa metin bloğunu, "in-context learning" yapması umuduyla LLM'e gönderir.
*   **Dezavantajları:**
    *   **Yüksek Gecikme (Latency):** Büyük DOM metinlerinin LLM'e gönderilmesi ve işlenmesi yavaştır.
    *   **Yüksek Maliyet:** Gereksiz yere çok fazla token kullanılır.
    *   **Düşük Doğruluk:** LLM, alakasız bilgilerle dolu bir "samanlıkta" doğru elementi (iğneyi) bulmaya çalışırken hata yapmaya müsaittir.

## 3. Önerilen Yeni Mimari: RAG Tabanlı Akıllı Otomasyon Motoru

### 3.1. Temel Felsefe: "Akıllı Bağlam, Odaklanmış LLM"

Yeni mimarinin temel amacı, LLM'i bir bilgi işlemcisinden bir karar vericiye dönüştürmektir. Ona tüm sayfayı analiz ettirmek yerine, RAG modelini kullanarak en olası hedef elementleri bir "mıknatıs" gibi çeker ve LLM'e sadece bu küçük, ilgili ve yüksek olasılıklı adayları sunarız.

### 3.2. Ana Bileşenler

1.  **DOM Anlamlandırma Motoru (DOM Enrichment Engine):**
    *   **Toplu İşleme (Batch Processing):** Sayfadaki tüm etkileşimli elemanların temel bilgileri (`id`, `class`, `role`, `placeholder` vb.) toplanır ve tek bir istekte LLM'e gönderilir.
    *   **Anlamsal Zenginleştirme:** LLM, her bir eleman için onun olası tüm kullanım amaçlarını, eş anlamlılarını ve kullanıcı ifadelerini içeren zengin bir `embedding_text` metni üretir. Bu işlem, her sayfa yapısı için sadece bir kez yapılır.

2.  **Vektör Veritabanı (Vector Database):**
    *   **Teknoloji:** Ölçeklenebilirlik ve kalıcılık için **Pinecone**, **Weaviate** veya **Chroma Cloud** gibi yönetilen (managed) bir bulut tabanlı (cloud-based) vektör veritabanı kullanılacaktır.
    *   **İşlev:** LLM tarafından zenginleştirilen metinler, bir embedding modeli (örn: `sentence-transformers`) kullanılarak vektöre dönüştürülür ve bu veritabanında saklanır.

3.  **Akıllı Önbellek Mekanizması (Intelligent Caching Mechanism):**
    *   **Amaç:** DOM'u ve vektör veritabanını her eylemde yeniden işleme maliyetini ortadan kaldırmak.
    *   **Katman 1: URL Yolu (Pathname) Anahtarı:** Önbellek anahtarı olarak URL'nin sorgu parametrelerinden ve hash'lerinden arındırılmış `pathname`'i kullanılır. Bu, aynı sayfa yapısının farklı veri varyasyonlarını gruplar.
    *   **Katman 2: Dayanıklı DOM Parmak İzi (Resilient DOM Fingerprint):** Önbellekteki verinin hala geçerli olup olmadığını doğrulamak için kullanılır.

4.  **Dayanıklı DOM Parmak İzi Algoritması:**
    *   **Problem:** Modern web framework'leri (`React`, `Vue` vb.) stil için rastgele ve dinamik class isimleri (`css-1q2w3e`) üretir. Basit bir DOM karşılaştırması bu yüzden işe yaramaz.
    *   **Çözüm:** Parmak izi oluşturulurken;
        *   **Göz Ardı Edilecekler:** Dinamik görünen, anlamsız ve sadece stil için kullanılan class isimleri.
        *   **Dahil Edilecekler:**
            *   **Yapısal Kimlik:** `id`, `name`, `data-testid`, `data-cy` gibi sabit ve anlamsal test/kimlik nitelikleri.
            *   **Anlamsal Nitelikler:** `role`, `type`, `aria-label`, `placeholder`.
            *   **Filtrelenmiş Class'lar:** `btn`, `login-form` gibi anlamlı ve sabit class'lar.
            *   **Yapısal Pozisyon:** Gerekirse elemanın ebeveynine göre konumu (`:nth-child` mantığı).

5.  **Domain Bazlı Veri İzolasyonu (Multi-tenancy):**
    *   **Problem:** Farklı web sitelerindeki benzer elemanların (örn: iki farklı sitedeki "Giriş Yap" butonu) vektörlerinin birbiriyle karışmasını önlemek.
    *   **Çözüm:** Vektör veritabanında, her domain için ayrı bir **"Namespace" (İsim Alanı)** kullanılacaktır (örn: `hepsiburada`, `pegasus`). Tüm veri ekleme ve sorgulama işlemleri, ilgili domain'in namespace'i altında yapılarak tam bir veri izolasyonu sağlanacaktır.

### 3.3. Uçtan Uca İş Akışı

1.  **Sayfaya Geliş:** Sistem yeni bir sayfaya gider.
2.  **Önbellek Kontrolü:** URL `pathname`'i kullanarak önbellekte bu sayfa için bir giriş olup olmadığını kontrol eder.
3.  **Cache Miss (Önbellek Boş):**
    *   **DOM'u Anlamlandır:** DOM'daki elemanları toplu bir LLM çağrısıyla zenginleştirir.
    *   **DB Oluştur:** Yeni bir vektör veritabanı oluşturur.
    *   **Parmak İzi Al:** Mevcut DOM'un "Dayanıklı Parmak İzi"ni hesaplar.
    *   **Kaydet:** DB'yi ve parmak izini URL anahtarıyla önbelleğe kaydeder.
    *   **Eyleme Devam Et:** Bu taze DB'yi kullanarak kullanıcı komutunu işler.
4.  **Cache Hit (Önbellek Dolu):**
    *   **Parmak İzi Doğrulaması:** Canlı DOM'un parmak izini hesaplar ve önbellekteki ile karşılaştırır.
    *   **Eşleşme Varsa (FAST PATH):** Hiçbir analiz yapmadan, doğrudan önbellekteki DB'yi kullanarak eylemi **anında** gerçekleştirir.
    *   **Eşleşme Yoksa (Stale Cache):** Önbellek girdisini geçersiz kılar ve süreci "Cache Miss" olarak yeniden başlatır.

## 4. Geliştirme Fazları

### Faz 1: MVP - Temel RAG Motoru ve Manuel Önbellek
*   **Görevler:**
    *   `faiss-node` veya benzeri bir kütüphaneyi entegre et.
    *   Basit DOM işleme mantığını yaz: Sadece `role`, `id`, `text`, `placeholder` gibi temel bilgileri alarak `embedding_text` oluştur (LLM zenginleştirmesi olmadan).
    *   Temel RAG akışını entegre et: Kullanıcı komutunu vektörleştir, DB'de ara ve en iyi adayı bul.
    *   LLM prompt'unu sadece aday elemanları içerecek şekilde güncelle.
    *   Önbelleği en basit haliyle (sadece tam URL eşleşmesi ile) ekle.

### Faz 2: Akıllı Önbellekleme ve Performans Optimizasyonları
*   **Görevler:**
    *   "Dayanıklı DOM Parmak İzi" algoritmasını geliştir.
    *   URL `pathname` ve parmak izi doğrulamasını içeren iki katmanlı akıllı önbellek mekanizmasını tamamen entegre et.
    *   `MutationObserver`'ı ekleyerek önbelleğin ne zaman geçersiz kılınacağını otomatik olarak belirle.

### Faz 3: LLM ile Anlamsal Zenginleştirme
*   **Görevler:**
    *   DOM elemanlarını toplu olarak işleyip zenginleştirecek olan LLM çağrı mantığını (DOM Enrichment Engine) geliştir.
    *   Faz 1'deki basit metin oluşturma mantığını, bu yeni LLM tabanlı zenginleştirme adımıyla değiştir.
    *   Token limitlerini aşma durumuna karşı "chunking" mantığını ekle.

## 5. Teknoloji ve Bağımlılıklar

*   **Vektör Veritabanı (Cloud-based):** Pinecone, Weaviate, Chroma Cloud (seçilecek)
*   **Embedding Modeli:** OpenAI `text-embedding-3-large`
*   **Hashing Algoritması:** `murmurhash` (hızlı ve verimli olduğu için)
*   **Dil:** TypeScript

## 6. Hibrit Araç Kullanım Modeli (Assertion'lar için)

Mevcut RAG tabanlı `Element_Bulucu` sistemi, yapısal elemanları bulmada mükemmeldir. Ancak, "sayfada 3 ürün olduğunu doğrula" gibi dinamik içerik veya durum sorgularını yanıtlayamaz. Bu tür `aiAssertion` görevlerini çözmek için hibrit bir "Araç Kullanımı" modeli benimsenecektir.

1.  **Router (Ana Karar Verici) LLM:**
    *   Her assertion komutu, önce bir Router LLM'e gönderilir.
    *   Router, komutun amacını analiz eder ve görevi çözmek için en uygun "aleti" seçer.

2.  **Alet Seti:**
    *   **`Element_Bulucu` (RAG Sistemi):** Komut, belirli bir butonu, input'u veya linki hedeflediğinde kullanılır. Vektör veritabanını sorgular.
    *   **`Görsel_Analizci` (Vision Modeli):** Komut, ekrandaki nesneleri sayma, metin okuma, renk doğrulama veya genel sayfa durumunu kontrol etme gibi görevler içerdiğinde kullanılır. Bu alet, sayfanın ekran görüntüsünü Vision API'sine (örn: GPT-4V) gönderir.

Bu mimari, sistemin hem yapısal hem de dinamik doğrulama görevlerini başarıyla yerine getirmesini sağlar.

## 7. Riskler ve Çözüm Önerileri

*   **Risk:** LLM ile zenginleştirme adımının gecikmeyi artırması.
    *   **Çözüm:** Akıllı önbellek mekanizması bu riski büyük ölçüde azaltacaktır. Gecikme, sadece bir sayfa ilk kez ziyaret edildiğinde veya yapısı değiştiğinde hissedilecektir.
*   **Risk:** Dayanıklı parmak izi algoritmasının hatalı çalışması (false positive/negative).
    *   **Çözüm:** Algoritmayı farklı framework'ler (React, Vue, Angular) üzerinde kapsamlı bir şekilde test etmek. Hata durumunda bir fallback mekanizması olarak önbelleği atlayıp yeniden analize zorlamak.
*   **Risk:** Token limitlerinin aşılması.
    *   **Çözüm:** Toplu istekleri makul boyutlardaki "chunk"lara bölerek göndermek. 