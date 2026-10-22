// Yasal metinler. TASLAKTIR: yayına almadan önce bir avukata kontrol ettirin.
// Köşeli parantezli alanlar ([Şirket Unvanı] vb.) şirket bilgileriyle doldurulmalıdır.
export type LegalSection = { id: string; title: string; body: string[] };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };

export const legal = {
  back: 'Geri',
  contents: 'İçindekiler',
  lastUpdated: 'Son güncelleme: {date}',
  updatedAt: '2026-10-25',
  reviewNote: 'Bu metin taslaktır. Yayına almadan önce şirket bilgileriyle doldurulmalı ve bir avukata kontrol ettirilmelidir.',
  notFoundTitle: 'Sayfa bulunamadı',
  notFoundBody: 'Aradığın yasal metin burada değil. Aşağıdaki bağlantılardan birini seç.',
  langSwitch: 'Dil',
  nav: { gizlilik: 'Gizlilik Politikası', kosullar: 'Kullanım Koşulları', kvkk: 'KVKK Aydınlatma Metni' },
  footer: '{privacy} · {terms} · {kvkk}',
  docs: {
    gizlilik: {
      title: 'Gizlilik Politikası',
      intro:
        'Davet ("biz"), etkinlik düzenleyenlerin (organizatör) davetiye göndermesine ve davetlilerin cevap vermesine yarayan bir hizmettir. Bu politika hangi verileri neden işlediğimizi, kimlerle paylaştığımızı ve haklarını açıklar. Kişisel verilerin korunmasına ilişkin ayrıntılı bilgi KVKK Aydınlatma Metni\'nde yer alır.',
      sections: [
        {
          id: 'roller',
          title: '1. Kim veri sorumlusu?',
          body: [
            'Organizatör hesabı verileri (ad, e-posta, telefon, paket ve ödeme kayıtları) için veri sorumlusu [Şirket Unvanı]\'dır.',
            'Organizatörün yüklediği davetli verileri (davetli adı, telefon, e-posta, cevaplar, masa) için veri sorumlusu organizatördür. Biz bu verileri yalnızca organizatör adına ve onun talimatıyla, veri işleyen olarak işleriz.',
          ],
        },
        {
          id: 'veriler',
          title: '2. Hangi verileri işliyoruz?',
          body: [
            'Organizatörler: e-posta adresi, ad, isteğe bağlı telefon, dil tercihi, oluşturulan etkinlikler, paket ve satın alma kayıtları, bildirim için cihaz anahtarı (push token), güvenlik kayıtları.',
            'Davetliler: organizatörün girdiği ad, telefon ve e-posta; davetlinin verdiği katılım cevabı, kişi sayısı, menü tercihi, not ve özel soru cevapları; organizatörün atadığı masa; WhatsApp ve e-posta teslim durumları.',
            'Ödeme kartı bilgilerini görmeyiz ve saklamayız. Web ödemeleri iyzico\'nun güvenli sayfasında, uygulama içi ödemeler Apple veya Google hesabın üzerinden alınır.',
            'Reklam amaçlı izleme yapmayız, verileri satmayız, üçüncü taraf reklam araçları kullanmayız.',
          ],
        },
        {
          id: 'amac',
          title: '3. Neden işliyoruz?',
          body: [
            'Hizmeti sunmak: hesap açma ve giriş, etkinlik ve davetli listesi, davetiye gönderimi, cevapların toplanması, oturma planı.',
            'Ödeme ve paket yönetimi, yasal yükümlülükler (fatura, muhasebe).',
            'Güvenlik: kötüye kullanımı önleme, hız sınırları, denetim kayıtları.',
            'Bildirim: davetli cevap verdiğinde organizatöre bildirim (ayarlardan kapatılabilir).',
          ],
        },
        {
          id: 'paylasim',
          title: '4. Kimlerle paylaşıyoruz?',
          body: [
            'Hizmeti sunmak için aşağıdaki hizmet sağlayıcılarla, yalnızca gereken ölçüde: Supabase (veritabanı, kimlik doğrulama, sunucu fonksiyonları), Meta Platforms (WhatsApp Business mesajları), Resend (e-posta gönderimi), Expo (mobil bildirimler), Cloudflare (web barındırma), RevenueCat, Apple ve Google (uygulama içi satın alma), iyzico (web ödemesi).',
            'Bu sağlayıcıların bir kısmı yurt dışındadır; aktarımlar KVKK\'nın 9. maddesine uygun şekilde yapılır (ayrıntı: KVKK Aydınlatma Metni).',
            'Yasal zorunluluk olmadıkça verileri resmi makamlar dahil kimseyle paylaşmayız.',
          ],
        },
        {
          id: 'guvenlik',
          title: '5. Verileri nasıl koruyoruz?',
          body: [
            'Her organizatör yalnızca kendi verisini görebilir; bu kural veritabanı düzeyinde zorunludur. Platform yöneticileri bile davetlilerin adını ve telefonunu göremez, yalnızca toplam sayıları görür; yönetici erişimi iki adımlı doğrulama gerektirir.',
            'Bağlantılar şifrelidir (HTTPS). Telefonda oturum bilgisi cihazın şifreli anahtar deposunda tutulur. Davetli bağlantıları tahmin edilemeyen rastgele anahtarlar içerir.',
          ],
        },
        {
          id: 'saklama',
          title: '6. Ne kadar saklıyoruz?',
          body: [
            'Hesap ve etkinlik verileri, sen hesabını ya da etkinliği silene kadar saklanır. Hesabını uygulamanın Ayarlar bölümünden kalıcı olarak silebilirsin; silme anında tüm etkinliklerin, davetli listelerin ve oturma planların da silinir.',
            'Satın alma kayıtları vergi mevzuatının gerektirdiği süre (genellikle 10 yıl) boyunca saklanır.',
            'Yedeklerdeki kopyalar en geç [30] gün içinde silinir.',
          ],
        },
        {
          id: 'haklar',
          title: '7. Hakların',
          body: [
            'Verilerine erişme, düzeltme, silme ve itiraz etme hakkın vardır (KVKK md. 11). Taleplerini [e-posta] adresine iletebilirsin.',
            'Davetliysen ve bilgilerinle ilgili bir talebin varsa, seni davet eden organizatöre başvurabilir ya da bize yazabilirsin; talebini organizatöre iletir ve yardımcı oluruz.',
          ],
        },
        {
          id: 'cocuklar',
          title: '8. Çocuklar',
          body: ['Organizatör hesabı yalnızca 18 yaşını doldurmuş kişiler içindir.'],
        },
        {
          id: 'iletisim',
          title: '9. İletişim ve değişiklikler',
          body: [
            '[Şirket Unvanı], [Adres], [KEP adresi], [e-posta].',
            'Bu politikayı güncelleyebiliriz; önemli değişiklikleri uygulama içinde duyururuz.',
          ],
        },
      ],
    } as LegalDoc,
    kosullar: {
      title: 'Kullanım Koşulları',
      intro: 'Davet\'i kullanarak bu koşulları kabul etmiş olursun. Lütfen dikkatlice oku.',
      sections: [
        {
          id: 'hizmet',
          title: '1. Hizmet',
          body: [
            'Davet; etkinlik oluşturma, davetiye hazırlama, WhatsApp, e-posta ve bağlantı ile davet gönderme, katılım cevaplarını toplama ve oturma planı hazırlama araçları sunar.',
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
            'Ücretli paketler tek seferlik ödemeyle bir yıl geçerlidir; otomatik yenileme yoktur. Süre bitince hesap ücretsiz pakete döner, verilerin silinmez.',
            'Fiyatlar KDV dahil Türk lirası olarak gösterilir. Web ödemeleri iyzico, uygulama içi ödemeler Apple veya Google üzerinden alınır.',
            'Paket, ödeme onaylanır onaylanmaz hesabına tanımlanan dijital bir hizmettir. Mesafeli Sözleşmeler Yönetmeliği md. 15/1-(ğ) uyarınca, anında ifa edilen dijital içeriklerde cayma hakkı bulunmamaktadır; teknik bir sorun nedeniyle hizmeti kullanamazsan [e-posta] adresine yaz, iade talebini değerlendiririz. Mağaza ödemelerinde iadeler Apple veya Google\'ın kurallarına tabidir.',
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
          id: 'sorumluluk',
          title: '7. Sorumluluğun sınırı',
          body: [
            'WhatsApp, e-posta ve mağaza gibi üçüncü taraf hizmetlerdeki kesinti ya da teslim sorunlarından sorumlu değiliz.',
            'Kanunen izin verilen ölçüde, dolaylı zararlardan sorumlu değiliz; sorumluluğumuz son 12 ayda ödediğin tutarla sınırlıdır.',
          ],
        },
        {
          id: 'hukuk',
          title: '8. Uygulanacak hukuk',
          body: ['Bu koşullara Türkiye Cumhuriyeti hukuku uygulanır. Tüketici işlemlerinde Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir.', '[Şirket Unvanı], [Adres], [MERSİS no], [e-posta].'],
        },
      ],
    } as LegalDoc,
    kvkk: {
      title: 'KVKK Aydınlatma Metni',
      intro:
        '6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") md. 10 uyarınca, [Şirket Unvanı] ("Davet") olarak kişisel verilerinizi nasıl işlediğimizi açıklarız.',
      sections: [
        {
          id: 'sorumlu',
          title: '1. Veri sorumlusu ve veri işleyen',
          body: [
            'Organizatör hesap verileri bakımından veri sorumlusu: [Şirket Unvanı], [Adres], [KEP adresi], [e-posta].',
            'Davetli verileri bakımından veri sorumlusu, davetiyeyi gönderen organizatördür. Davet bu verileri organizatör adına ve talimatı doğrultusunda veri işleyen sıfatıyla işler.',
          ],
        },
        {
          id: 'kategoriler',
          title: '2. İşlenen veri kategorileri',
          body: [
            'Kimlik: ad soyad.',
            'İletişim: e-posta, telefon numarası.',
            'Müşteri işlem: etkinlik bilgileri, katılım cevapları, menü tercihi, notlar, özel soru cevapları, masa bilgisi, mesaj teslim durumları.',
            'Finans: satın alınan paket, tutar ve ödeme referansı (kart bilgisi işlenmez).',
            'İşlem güvenliği: giriş kayıtları, cihaz bildirim anahtarı, denetim kayıtları.',
          ],
        },
        {
          id: 'amac-hukuki',
          title: '3. Amaçlar ve hukuki sebepler (KVKK md. 5)',
          body: [
            'Hizmet sözleşmesinin kurulması ve ifası (md. 5/2-c): hesap, etkinlik, davetiye gönderimi, cevapların toplanması, oturma planı.',
            'Hukuki yükümlülüğün yerine getirilmesi (md. 5/2-ç): fatura ve muhasebe kayıtları.',
            'Meşru menfaat (md. 5/2-f): hizmet güvenliği, kötüye kullanımın önlenmesi, hata giderme.',
            'Davetli verileri, organizatörün belirlediği amaçla (davet ve katılım takibi) ve organizatörün dayandığı hukuki sebebe göre işlenir.',
          ],
        },
        {
          id: 'aktarim',
          title: '4. Aktarım (KVKK md. 8 ve 9)',
          body: [
            'Hizmetin sunulması için veriler şu hizmet sağlayıcılarına aktarılır: Supabase Inc. (veritabanı ve barındırma; veri bölgesi: [AB – Frankfurt]), Meta Platforms Ireland Ltd. (WhatsApp Business), Resend Inc. (e-posta), 650 Industries Inc. / Expo (mobil bildirim), Cloudflare Inc. (web barındırma), RevenueCat Inc., Apple ve Google (uygulama içi satın alma), iyzico Ödeme Hizmetleri A.Ş. (web ödemesi, yurt içi).',
            'Yurt dışına aktarımlar KVKK md. 9 kapsamında Kurul\'un ilan ettiği standart sözleşmeler ile yapılır ve standart sözleşmeler süresi içinde Kurul\'a bildirilir. [Avukat kontrolü: sağlayıcı bazında aktarım dayanağını doğrulayın.]',
            'Yasal zorunluluk halinde yetkili kamu kurum ve kuruluşlarına aktarım yapılabilir.',
          ],
        },
        {
          id: 'yontem',
          title: '5. Toplama yöntemi',
          body: [
            'Veriler; uygulama ve web sitesi üzerinden organizatörün girdiği bilgiler, davetlinin davetiye sayfasında verdiği cevaplar ve WhatsApp butonları, Excel/CSV aktarımı ve organizatörün izniyle telefon rehberinden seçilen kişiler aracılığıyla, elektronik ortamda otomatik yollarla toplanır.',
          ],
        },
        {
          id: 'saklama',
          title: '6. Saklama süresi',
          body: [
            'Hesap ve etkinlik verileri hesap ya da etkinlik silinene kadar; finansal kayıtlar ilgili mevzuatta öngörülen süre (Vergi Usul Kanunu uyarınca 5 yıl, Türk Ticaret Kanunu uyarınca 10 yıl) boyunca saklanır. Süre sonunda veriler silinir, yok edilir veya anonim hale getirilir.',
          ],
        },
        {
          id: 'haklar',
          title: '7. Haklarınız (KVKK md. 11)',
          body: [
            'Kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini, KVKK md. 7 şartlarında silinmesini veya yok edilmesini isteme, bu işlemlerin aktarılan üçüncü kişilere bildirilmesini isteme, otomatik sistemlerle analiz sonucu aleyhinize bir sonuca itiraz etme ve kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme haklarına sahipsiniz.',
            'Başvurularınızı [e-posta] adresine veya [Adres] adresine yazılı olarak iletebilirsiniz. Başvurular en geç 30 gün içinde ücretsiz sonuçlandırılır.',
            'Davetliyseniz, verilerinizle ilgili başvurunuzu öncelikle sizi davet eden organizatöre yapabilirsiniz; bize ulaşan başvuruları organizatöre iletir ve sonuçlanmasına yardımcı oluruz.',
          ],
        },
      ],
    } as LegalDoc,
  },
};
