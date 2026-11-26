// Yasal metinler. TASLAKTIR: yayına almadan önce bir avukata kontrol ettirin.
// Invitefolk şimdilik şirket kurulmadan, gerçek kişi tarafından işletilir. Köşeli parantezli alanlar
// ([Ad Soyad], [Yazışma adresi]) işleten kişinin bilgileriyle doldurulmalıdır.
export type LegalSection = { id: string; title: string; body: string[] };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };

export const legal = {
  back: 'Geri',
  contents: 'İçindekiler',
  lastUpdated: 'Son güncelleme: {date}',
  updatedAt: '2026-11-26',
  reviewNote: 'Bu metin taslaktır. Yayına almadan önce veri sorumlusunun adı ve yazışma adresi doldurulmalı ve bir avukata kontrol ettirilmelidir.',
  notFoundTitle: 'Sayfa bulunamadı',
  notFoundBody: 'Aradığın yasal metin burada değil. Aşağıdaki bağlantılardan birini seç.',
  langSwitch: 'Dil',
  nav: { gizlilik: 'Gizlilik Politikası', kosullar: 'Kullanım Koşulları', kvkk: 'KVKK Aydınlatma Metni' },
  footer: '{privacy} · {terms} · {kvkk}',
  docs: {
    gizlilik: {
      title: 'Gizlilik Politikası',
      intro:
        'Invitefolk ("biz"), etkinlik düzenleyenlerin (organizatör) davetiye göndermesine ve davetlilerin cevap vermesine yarayan bir hizmettir. Bu politika hangi verileri neden işlediğimizi, kimlerle paylaştığımızı, ne kadar sakladığımızı ve haklarını açıklar. Kişisel verilerin korunmasına ilişkin ayrıntılı bilgi KVKK Aydınlatma Metni\'nde yer alır.',
      sections: [
        {
          id: 'roller',
          title: '1. Kim veri sorumlusu?',
          body: [
            'Invitefolk, [Ad Soyad] tarafından şahsen (şirket kurulmadan) işletilmektedir. Organizatör hesabı verileri (ad, e-posta, telefon, paket ve satın alma kayıtları) için veri sorumlusu [Ad Soyad]\'dır.',
            'Organizatörün yüklediği davetli verileri (davetli adı, telefon, e-posta, cevaplar, masa) için veri sorumlusu organizatördür. Biz bu verileri yalnızca organizatör adına ve onun talimatıyla, veri işleyen olarak işleriz.',
          ],
        },
        {
          id: 'veriler',
          title: '2. Hangi verileri işliyoruz?',
          body: [
            'Organizatörler: e-posta adresi, ad, isteğe bağlı telefon, dil tercihi, oluşturulan etkinlikler, paket ve satın alma kayıtları, bildirim için cihaz anahtarı (push token), güvenlik kayıtları.',
            'Davetliler: organizatörün girdiği ad, telefon ve e-posta; davetlinin verdiği katılım cevabı, kişi sayısı, menü tercihi, not ve özel soru cevapları; organizatörün atadığı masa; WhatsApp, SMS ve e-posta teslim durumları; davetiyenin açılıp açılmadığı; kapıda giriş zamanı; çocuk sayısı ve yanındakilerin adları (organizatör sorarsa); tarih anketi oyları, getir listesi seçimleri, halı sahada takım, gol ve oylar; davetlinin albüme yüklediği fotoğraf, video ve sesli mesajlar, anı defterine yazdığı ad ve mesajlar ve bilgi toplama formuna yazdıkları.',
            'Organizatörün yüklediği davetiye görselleri, galeri fotoğrafları, video ve müzik dosyaları; organizatörün herkese açık işaretlediği hediye/IBAN bilgisi. Uygulama para toplamaz; IBAN yalnızca gösterilir.',
            'Hata kayıtları: uygulama çöktüğünde ya da bir hata oluştuğunda hata metni, uygulama sürümü, cihaz ve tarayıcı türü. Bu kayıtlardan davet bağlantıları, e-posta adresleri ve telefon numaraları gönderilmeden önce silinir; kullanıcı kimliği eklenmez.',
            'Ödeme kartı bilgilerini görmeyiz ve saklamayız. Paketler App Store veya Google Play üzerinden, Apple veya Google hesabınla satın alınır.',
            'Reklam amaçlı izleme yapmayız, verileri satmayız, üçüncü taraf reklam ya da analitik araçları kullanmayız.',
          ],
        },
        {
          id: 'yuz',
          title: '3. Yüz önerisi (selfie ile fotoğraf bulma)',
          body: [
            'Organizatör açarsa, herkese açık albümdeki davetliler bir selfie seçerek albümde kendilerine benzeyen fotoğrafları görebilir. Bu özellik isteğe bağlıdır ve yalnızca davetli açık rıza verdikten sonra çalışır.',
            'Yüz verisi (selfie\'den ve albüm fotoğraflarından çıkarılan yüz vektörleri, biyometrik veri) yalnızca davetlinin kendi cihazında işlenir ve en fazla 30 gün yalnızca o cihazda saklanır. Sunucularımıza, organizatöre ya da başka bir yere gönderilmez; biz ve organizatör bu veriyi göremeyiz.',
            'Davetli, rızasını istediği an "Yüz verimi sil" ile geri alabilir; bu, cihazdaki bütün yüz verisini siler. Organizatör özelliği kapatırsa özellik hemen durur.',
          ],
        },
        {
          id: 'amac',
          title: '4. Neden işliyoruz?',
          body: [
            'Hizmeti sunmak: hesap açma ve giriş, etkinlik ve davetli listesi, davetiye gönderimi, cevapların toplanması, oturma planı, albüm ve anı defteri.',
            'Paket yönetimi ve yasal yükümlülükler.',
            'Güvenlik ve hizmetin sürekliliği: kötüye kullanımı ve otomatik (bot) kayıtları önleme, hız sınırları, denetim kayıtları, hata takibi.',
            'Bildirim: davetli cevap verdiğinde organizatöre bildirim ve günlük özet e-postası (ayarlardan kapatılabilir).',
          ],
        },
        {
          id: 'paylasim',
          title: '5. Kimlerle paylaşıyoruz?',
          body: [
            'Hizmeti sunmak için aşağıdaki hizmet sağlayıcılarla, yalnızca gereken ölçüde: Supabase (veritabanı, kimlik doğrulama, dosya ve sunucu fonksiyonları; veri bölgesi AB – Frankfurt), Meta Platforms (WhatsApp Business mesajları), Netgsm (SMS), e-posta gönderim sağlayıcısı (Resend veya Brevo), Open-Meteo (etkinlik adresine göre hava tahmini; kişisel veri gönderilmez), Expo (mobil bildirimler), Cloudflare (web barındırma ve otomatik kayıtlara karşı Turnstile doğrulaması), Sentry (hata takibi; kişisel veriler ayıklanmış), RevenueCat, Apple ve Google (uygulama içi satın alma).',
            'Bu sağlayıcıların bir kısmı yurt dışındadır; aktarımlar KVKK\'nın 9. maddesine uygun şekilde yapılır (ayrıntı: KVKK Aydınlatma Metni).',
            'Yasal zorunluluk olmadıkça verileri resmi makamlar dahil kimseyle paylaşmayız.',
          ],
        },
        {
          id: 'guvenlik',
          title: '6. Verileri nasıl koruyoruz?',
          body: [
            'Her organizatör yalnızca kendi verisini görebilir; bu kural veritabanı düzeyinde zorunludur. Platform yöneticisi bile davetlilerin adını ve telefonunu göremez, yalnızca toplam sayıları görür; yönetici erişimi iki adımlı doğrulama gerektirir.',
            'Bağlantılar şifrelidir (HTTPS). Telefonda oturum bilgisi cihazın şifreli anahtar deposunda tutulur. Davetli bağlantıları tahmin edilemeyen rastgele anahtarlar içerir; dosyalar özel depolamada durur ve yalnızca kısa süreli imzalı bağlantılarla gösterilir.',
          ],
        },
        {
          id: 'saklama',
          title: '7. Ne kadar saklıyoruz?',
          body: [
            'Etkinlik ve davetli verileri: etkinlik tarihinden 13 ay sonra etkinlik arşivlenir (davetiye ve albüm sayfası kapanır); 2 yıl sonra etkinlik, davetli listesi, cevaplar, albüm ve anı defteri dosyalarıyla birlikte kalıcı olarak silinir. Tarihi girilmemiş etkinlikler oluşturulmalarından 30 ay sonra silinir. Organizatör bunları daha önce de silebilir.',
            'Hesap verileri: hesabını Ayarlar bölümünden kalıcı olarak silebilirsin; silme anında yüklediğin bütün dosyalar, etkinliklerin, davetli listelerin ve rehberindeki kişiler de silinir.',
            'Yüz önerisi verisi yalnızca davetlinin cihazında, en fazla 30 gün tutulur.',
            'Satın alma kayıtları vergi mevzuatının gerektirdiği süre boyunca saklanır. Yedeklerdeki kopyalar en geç 30 gün içinde silinir.',
          ],
        },
        {
          id: 'haklar',
          title: '8. Hakların',
          body: [
            'Verilerine erişme, düzeltme, silme ve itiraz etme hakkın vardır (KVKK md. 11). Taleplerini info@invitefolk.com adresine iletebilirsin.',
            'Davetliysen ve bilgilerinle ilgili bir talebin varsa, seni davet eden organizatöre başvurabilir ya da bize yazabilirsin; talebini organizatöre iletir ve yardımcı oluruz.',
          ],
        },
        {
          id: 'cocuklar',
          title: '9. Çocuklar',
          body: ['Organizatör hesabı yalnızca 18 yaşını doldurmuş kişiler içindir.'],
        },
        {
          id: 'iletisim',
          title: '10. İletişim ve değişiklikler',
          body: ['[Ad Soyad], [Yazışma adresi], info@invitefolk.com.', 'Bu politikayı güncelleyebiliriz; önemli değişiklikleri uygulama içinde duyururuz.'],
        },
      ],
    } as LegalDoc,
    kosullar: {
      title: 'Kullanım Koşulları',
      intro: 'Invitefolk\'u kullanarak bu koşulları kabul etmiş olursun. Lütfen dikkatlice oku. Hizmet, [Ad Soyad] tarafından şahsen işletilir.',
      sections: [
        {
          id: 'hizmet',
          title: '1. Hizmet',
          body: [
            'Invitefolk; etkinlik oluşturma, davetiye hazırlama, WhatsApp, e-posta ve bağlantı ile davet gönderme, katılım cevaplarını toplama, oturma planı, fotoğraf albümü ve anı defteri araçları sunar.',
            'Hizmeti geliştirmek için özellikleri değiştirebiliriz. Kesintisiz ve hatasız çalışma garantisi vermeyiz; makul özeni gösteririz.',
          ],
        },
        {
          id: 'hesap',
          title: '2. Hesap',
          body: [
            'Hesap açmak için 18 yaşını doldurmuş olmalısın. Giriş e-postana gönderilen tek kullanımlık kodla yapılır; e-posta hesabının güvenliğinden sen sorumlusun.',
            'Hesabını istediğin zaman Ayarlar bölümünden kalıcı olarak silebilirsin.',
          ],
        },
        {
          id: 'davetliler',
          title: '3. Davetli verileri ve izin',
          body: [
            'Davetli listesine eklediğin kişilerin verileri için veri sorumlusu sensin. Bu kişilere davetiye göndermek için gerekli hukuki dayanağa sahip olduğunu kabul edersin.',
            'Albümü herkese açarsan, masadaki karekodu bilen herkes fotoğraf, video ve mesaj yükleyebilir. Yüklenenler varsayılan olarak sen onaylayana kadar yayınlanmaz; onayı kapatırsan yayınlanan içerikten sen sorumlusun.',
            'Hizmeti istenmeyen toplu mesaj (spam), reklam ya da davet dışı amaçlarla kullanamazsın. WhatsApp Business ve e-posta sağlayıcılarının kurallarına uyulması zorunludur.',
          ],
        },
        {
          id: 'yasak',
          title: '4. Yasaklı kullanımlar',
          body: [
            'Hukuka aykırı, yanıltıcı, nefret söylemi içeren ya da başkalarının haklarını ihlal eden içerik yükleyemezsin.',
            'Sistemin güvenliğini aşmaya, başka kullanıcıların verisine erişmeye, hizmeti aşırı yüke sokmaya çalışamazsın.',
            'Bu kurallara aykırılıkta hesabını askıya alabilir ya da kapatabiliriz.',
          ],
        },
        {
          id: 'paketler',
          title: '5. Paketler ve ödeme',
          body: [
            'Paketler App Store veya Google Play üzerinden, uygulama içi satın almayla alınır; aynı hesapla web panelinde de açılır. Fiyatlar mağazada gösterildiği şekildedir.',
            'Ücretli paketler tek seferlik ödemeyle en az bir yıl geçerlidir. Paket döneminde açılan etkinliğe ilk girilen tarih daha ileriyse paket etkinlikten altı ay sonrasına kadar uzar; bu süre bir kez hesaplanır ve satın almadan en fazla iki yıldır. Otomatik yenileme yoktur.',
            'Paketteki etkinlik hakkı, davetli eklenmiş bir etkinlik silindiğinde geri verilmez; davetli eklenmeden silinen etkinliğin hakkı geri verilir.',
            'Üst pakete geçişte yalnızca paket fiyatları arasındaki fark ödenir ve süre değişmez. Anı albümü eklentisi en az bir yıl, etkinlikten bir yıl sonrasına kadar (satın almadan en fazla iki buçuk yıl) açık kalır.',
            'Süre bitince hesap ücretsiz pakete döner; veriler 7. maddedeki saklama süreleri doluncaya kadar korunur.',
            'Paket, ödeme onaylanır onaylanmaz hesabına tanımlanan dijital bir hizmettir. Mesafeli Sözleşmeler Yönetmeliği md. 15/1-(ğ) uyarınca, anında ifa edilen dijital içeriklerde cayma hakkı bulunmamaktadır. Mağaza ödemelerinde iadeler Apple veya Google\'ın kurallarına tabidir; teknik bir sorun nedeniyle hizmeti kullanamazsan info@invitefolk.com adresine yaz.',
          ],
        },
        {
          id: 'icerik',
          title: '6. İçerik',
          body: [
            'Yüklediğin davetiye tasarımları ve metinler sana aittir. Hizmeti sunmak için bunları saklama ve davetlilerine gösterme iznini bize verirsin.',
            'Başkasına ait görselleri yalnızca kullanım hakkın varsa yükleyebilirsin.',
          ],
        },
        {
          id: 'saklama',
          title: '7. Saklama',
          body: ['Etkinlikler, tarihlerinden 13 ay sonra arşivlenir ve 2 yıl sonra bütün davetli verisi ve dosyalarıyla kalıcı olarak silinir (ayrıntı: Gizlilik Politikası). Saklamak istediğin fotoğraf ve listeleri bu süre dolmadan indir.'],
        },
        {
          id: 'sorumluluk',
          title: '8. Sorumluluğun sınırı',
          body: [
            'WhatsApp, e-posta ve mağaza gibi üçüncü taraf hizmetlerdeki kesinti ya da teslim sorunlarından sorumlu değiliz.',
            'Kanunen izin verilen ölçüde, dolaylı zararlardan sorumlu değiliz; sorumluluğumuz son 12 ayda ödediğin tutarla sınırlıdır.',
          ],
        },
        {
          id: 'hukuk',
          title: '9. Uygulanacak hukuk',
          body: ['Bu koşullara Türkiye Cumhuriyeti hukuku uygulanır. Tüketici işlemlerinde Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir.', '[Ad Soyad], [Yazışma adresi], info@invitefolk.com.'],
        },
      ],
    } as LegalDoc,
    kvkk: {
      title: 'KVKK Aydınlatma Metni',
      intro:
        '6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") md. 10 uyarınca, Invitefolk\'u işleten [Ad Soyad] olarak kişisel verilerinizi nasıl işlediğimizi açıklarız.',
      sections: [
        {
          id: 'sorumlu',
          title: '1. Veri sorumlusu ve veri işleyen',
          body: [
            'Organizatör hesap verileri bakımından veri sorumlusu: [Ad Soyad] (gerçek kişi), [Yazışma adresi], info@invitefolk.com.',
            'Davetli verileri bakımından veri sorumlusu, davetiyeyi gönderen organizatördür. Invitefolk bu verileri organizatör adına ve talimatı doğrultusunda veri işleyen sıfatıyla işler.',
          ],
        },
        {
          id: 'kategoriler',
          title: '2. İşlenen veri kategorileri',
          body: [
            'Kimlik: ad soyad.',
            'İletişim: e-posta, telefon numarası.',
            'Müşteri işlem: etkinlik bilgileri, katılım cevapları, menü tercihi, notlar, özel soru cevapları, masa bilgisi, mesaj teslim durumları.',
            'Görsel ve işitsel kayıtlar: organizatörün ve davetlilerin yüklediği fotoğraf, video ve ses kayıtları.',
            'Finans: satın alınan paket, tutar ve mağaza işlem referansı (kart bilgisi işlenmez).',
            'İşlem güvenliği: giriş kayıtları, cihaz bildirim anahtarı, denetim kayıtları, kişisel verileri ayıklanmış hata kayıtları.',
            'Biyometrik veri: yüz önerisi özelliğinde yüz vektörleri yalnızca davetlinin kendi cihazında, açık rızasıyla işlenir; tarafımıza aktarılmaz ve tarafımızca saklanmaz.',
          ],
        },
        {
          id: 'amac-hukuki',
          title: '3. Amaçlar ve hukuki sebepler (KVKK md. 5 ve 6)',
          body: [
            'Hizmet sözleşmesinin kurulması ve ifası (md. 5/2-c): hesap, etkinlik, davetiye gönderimi, cevapların toplanması, oturma planı, albüm.',
            'Hukuki yükümlülüğün yerine getirilmesi (md. 5/2-ç): mevzuatın gerektirdiği kayıtlar.',
            'Meşru menfaat (md. 5/2-f): hizmet güvenliği, kötüye kullanımın ve otomatik kayıtların önlenmesi, hata takibi ve giderme.',
            'Açık rıza (md. 6): yüz önerisi özelliğinde, davetlinin cihazında yapılan biyometrik işleme. Rıza her zaman geri alınabilir. [Avukat kontrolü: cihaz içi işlemede veri sorumlusunun ve rızanın kapsamını doğrulayın.]',
            'Davetli verileri, organizatörün belirlediği amaçla (davet ve katılım takibi) ve organizatörün dayandığı hukuki sebebe göre işlenir.',
          ],
        },
        {
          id: 'aktarim',
          title: '4. Aktarım (KVKK md. 8 ve 9)',
          body: [
            'Hizmetin sunulması için veriler şu hizmet sağlayıcılarına aktarılır: Supabase Inc. (veritabanı, dosya ve barındırma; veri bölgesi: AB – Frankfurt), Meta Platforms Ireland Ltd. (WhatsApp Business), Netgsm İletişim A.Ş. (SMS, yurt içi), Resend Inc. veya Sendinblue SAS / Brevo (e-posta), 650 Industries Inc. / Expo (mobil bildirim), Cloudflare Inc. (web barındırma ve bot doğrulaması), Functional Software Inc. / Sentry (hata takibi), RevenueCat Inc., Apple ve Google (uygulama içi satın alma).',
            'Yurt dışına aktarımlar KVKK md. 9 kapsamında Kurul\'un ilan ettiği standart sözleşmeler ile yapılır ve standart sözleşmeler süresi içinde Kurul\'a bildirilir. [Avukat kontrolü: sağlayıcı bazında aktarım dayanağını doğrulayın.]',
            'Yasal zorunluluk halinde yetkili kamu kurum ve kuruluşlarına aktarım yapılabilir.',
          ],
        },
        {
          id: 'yontem',
          title: '5. Toplama yöntemi',
          body: [
            'Veriler; uygulama ve web sitesi üzerinden organizatörün girdiği bilgiler, davetlinin davetiye sayfasında verdiği cevaplar ve WhatsApp butonları, albüm ve anı defteri yüklemeleri, Excel/CSV aktarımı ve organizatörün izniyle telefon rehberinden seçilen kişiler aracılığıyla, elektronik ortamda otomatik yollarla toplanır.',
          ],
        },
        {
          id: 'saklama',
          title: '6. Saklama süresi',
          body: [
            'Etkinlik ve davetli verileri etkinlik tarihinden 2 yıl sonra (tarihi olmayan etkinliklerde oluşturulmadan 30 ay sonra) dosyalarıyla birlikte silinir; etkinlik bundan önce, tarihinden 13 ay sonra arşivlenir. Hesap verileri hesap silinene kadar saklanır. Finansal kayıtlar ilgili mevzuatta öngörülen süre boyunca saklanır. Süre sonunda veriler silinir, yok edilir veya anonim hale getirilir.',
          ],
        },
        {
          id: 'haklar',
          title: '7. Haklarınız (KVKK md. 11)',
          body: [
            'Kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini, KVKK md. 7 şartlarında silinmesini veya yok edilmesini isteme, bu işlemlerin aktarılan üçüncü kişilere bildirilmesini isteme, otomatik sistemlerle analiz sonucu aleyhinize bir sonuca itiraz etme ve kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme haklarına sahipsiniz.',
            'Başvurularınızı info@invitefolk.com adresine veya [Yazışma adresi] adresine yazılı olarak iletebilirsiniz. Başvurular en geç 30 gün içinde ücretsiz sonuçlandırılır.',
            'Davetliyseniz, verilerinizle ilgili başvurunuzu öncelikle sizi davet eden organizatöre yapabilirsiniz; bize ulaşan başvuruları organizatöre iletir ve sonuçlanmasına yardımcı oluruz.',
          ],
        },
      ],
    } as LegalDoc,
  },
};
