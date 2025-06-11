# Özellik: Reaktif DOM Yönetimi ile Akıllı Otomasyon

## 1. Hedef

Mevcut her `aiAction` çağrısında tüm DOM'u yeniden tarama işlemini ortadan kaldırarak performansı artırmak ve `MutationObserver` kullanarak dinamik sayfa değişikliklerine karşı otomasyonu daha stabil hale getirmek.

## 2. Mimari

Sistem, bir `DOMStateManager` ve bir `ObserverAgent` içerecektir.
- **DOMStateManager:** Ana uygulama tarafında yaşayacak ve DOM'un güncel bir temsilini bellekte tutacaktır.
- **ObserverAgent:** Tarayıcı sayfasına enjekte edilecek ve DOM mutasyonlarını dinleyip `DOMStateManager`'a raporlayacaktır.

## 3. İş Akışı

### A. İlk İstek (Sayfa Başına Bir Kez)

1.  **`aiAction` -> Tam Tarama:**
    - `webExtractNodeTree()` ile tam DOM ağacı alınır.
    - Ekran görüntüsü alınır.
2.  **`aiAction` -> `UIContext` Oluşturma:**
    - Ağaç ve görüntü ile `UIContext` oluşturulur.
3.  **`aiAction` -> LLM Çağrısı:**
    - `UIContext` LLM'e gönderilir.
4.  **Sistem -> Durumu Başlatma:**
    - Alınan tam ağaç ile `DOMStateManager` başlatılır.
    - `ObserverAgent` sayfaya enjekte edilir ve dinlemeye başlar.

### B. Sonraki İstekler (Aynı URL'de)

1.  **`aiAction` -> Hızlı Durum Alma:**
    - `DOMStateManager.getCurrentTree()` çağrılır (HIZLI).
    - Yeni ekran görüntüsü alınır.
2.  **`aiAction` -> `UIContwext` Oluşturma:**
    - Güncel ağaç ve yeni görüntü ile `UIContext` oluşturulur.
3.  **`aiAction` -> LLM Çağrısı:**
    - Yeni ve tam `UIContext` LLM'e gönderilir.

### C. Navigasyon (URL Değişikliği)

1.  **Sistem -> Durumu Sıfırlama:**
    - Mevcut `DOMStateManager` ve `ObserverAgent` yok edilir.
2.  **Sistem -> Akış (A)'ya Geri Döner.**

## 4. Rasyonel

- **Bağlam Bütünlüğü:** LLM'e her zaman tam karar verme bağlamı (`güncel tam ağaç` + `güncel ekran görüntüsü`) sunulur.
- **Maksimum Performans:** Verimlilik, yavaş olan tam DOM tarama işlemini ortadan kaldırmaktan gelir.
- **Stabilite:** Eylemler, sayfanın en güncel ve doğrulanmış durumuna göre yapılır, bu da "stale element" hatalarını minimize eder.w