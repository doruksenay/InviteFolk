// Legal texts. DRAFT: have a lawyer review before publishing. Fill in the [bracketed] company details.
import type { legal as TR } from '../tr/legal';

export const legal: typeof TR = {
  back: 'Back',
  contents: 'Contents',
  lastUpdated: 'Last updated: {date}',
  updatedAt: '2026-10-25',
  reviewNote: 'This is a draft. Before publishing it must be completed with company details and reviewed by a lawyer. If the Turkish and English versions differ, the Turkish version prevails.',
  notFoundTitle: 'Page not found',
  notFoundBody: "The legal page you're looking for isn't here. Choose one of the links below.",
  langSwitch: 'Language',
  nav: { gizlilik: 'Privacy Policy', kosullar: 'Terms of Use', kvkk: 'KVKK Notice' },
  footer: '{privacy} · {terms} · {kvkk}',
  docs: {
    gizlilik: {
      title: 'Privacy Policy',
      intro:
        'Invitefolk ("we") is a service that helps event organisers send invitations and lets guests reply. This policy explains what data we process and why, who we share it with, and your rights. Details under Turkish data protection law are in the KVKK Notice.',
      sections: [
        {
          id: 'roller',
          title: '1. Who is the data controller?',
          body: [
            'For organiser account data (name, email, phone, plan and purchase records), the data controller is [Company Name].',
            'For guest data uploaded by an organiser (guest name, phone, email, replies, table), the organiser is the data controller. We process that data only on the organiser’s behalf and instructions, as a data processor.',
          ],
        },
        {
          id: 'veriler',
          title: '2. What data we process',
          body: [
            'Organisers: email address, name, optional phone, language preference, events created, plan and purchase records, a device token for notifications, security logs.',
            'Guests: the name, phone and email entered by the organiser; the guest’s reply, party size, menu choice, note and answers to custom questions; the table assigned by the organiser; WhatsApp, SMS and email delivery statuses; whether the invitation was opened; check-in time at the door; number of children and companions’ names (if the organiser asks); date poll votes, “who brings what” choices, football teams, goals and votes; photos, videos and voice messages the guest uploads to the album, the name and messages written in the guestbook, and details entered in the guest info form.',
            'Invitation images, gallery photos, video and music files uploaded by the organiser; gift/IBAN details the organiser marks as public. The app does not collect money; the IBAN is only displayed.',
            'We never see or store card details. Web payments are taken on iyzico’s secure page; in-app payments go through your Apple or Google account.',
            'We do no advertising tracking, do not sell data and use no third-party ad tools.',
          ],
        },
        {
          id: 'amac',
          title: '3. Why we process it',
          body: [
            'To provide the service: account and sign-in, events and guest lists, sending invitations, collecting replies, seating plans.',
            'Payments and plan management, and legal obligations (invoicing, accounting).',
            'Security: preventing abuse, rate limits, audit logs.',
            'Notifications: telling organisers when a guest replies (can be turned off in Settings).',
          ],
        },
        {
          id: 'paylasim',
          title: '4. Who we share it with',
          body: [
            'Only as needed to run the service, with these providers: Supabase (database, authentication, server functions), Meta Platforms (WhatsApp Business messages), Netgsm (SMS), Resend (email delivery), Open-Meteo (weather forecast from the event address; no personal data is sent), Expo (mobile notifications), Cloudflare (web hosting), RevenueCat, Apple and Google (in-app purchases), iyzico (web payments).',
            'Some of these providers are outside Turkey; transfers are made in line with Article 9 of the KVKK (see the KVKK Notice).',
            'We do not share data with anyone, including authorities, unless legally required.',
          ],
        },
        {
          id: 'guvenlik',
          title: '5. How we protect it',
          body: [
            'Each organiser can only see their own data, enforced at the database level. Even platform admins cannot see guest names or phone numbers, only totals, and admin access requires two-step verification.',
            'Connections are encrypted (HTTPS). On phones, your session is stored in the device’s encrypted keychain. Guest links contain unguessable random keys.',
          ],
        },
        {
          id: 'saklama',
          title: '6. How long we keep it',
          body: [
            'Account and event data are kept until you delete the event or your account. You can permanently delete your account in Settings; all your events, guest lists and seating plans are deleted at the same time.',
            'Purchase records are kept for as long as tax law requires (usually 10 years).',
            'Copies in backups are removed within [30] days.',
          ],
        },
        {
          id: 'haklar',
          title: '7. Your rights',
          body: [
            'You have the right to access, correct, delete and object to the processing of your data (KVKK Art. 11). Send requests to info@invitefolk.com.',
            'If you are a guest with a request about your details, you can contact the organiser who invited you or write to us; we will pass it on and help.',
          ],
        },
        {
          id: 'cocuklar',
          title: '8. Children',
          body: ['Organiser accounts are only for people aged 18 or over.'],
        },
        {
          id: 'iletisim',
          title: '9. Contact and changes',
          body: ['[Company Name], [Address], [Registered e-mail (KEP)], info@invitefolk.com.', 'We may update this policy; we will announce important changes in the app.'],
        },
      ],
    },
    kosullar: {
      title: 'Terms of Use',
      intro: 'By using Invitefolk you agree to these terms. Please read them carefully.',
      sections: [
        {
          id: 'hizmet',
          title: '1. The service',
          body: [
            'Invitefolk provides tools to create events, design invitations, send them via WhatsApp, email and links, collect replies and plan seating.',
            'We may change features to improve the service. We take reasonable care but do not guarantee uninterrupted or error-free operation.',
          ],
        },
        {
          id: 'hesap',
          title: '2. Your account',
          body: [
            'You must be 18 or over to create an account. You sign in with a one-time code sent to your email; you are responsible for keeping your email account secure.',
            'You can permanently delete your account at any time in Settings.',
          ],
        },
        {
          id: 'davetliler',
          title: '3. Guest data and consent',
          body: [
            'You are the data controller for the people you add to your guest lists. You confirm you have a lawful basis to send them invitations.',
            'You may not use the service for unsolicited bulk messages (spam), advertising or anything other than invitations. The rules of WhatsApp Business and email providers must be followed.',
          ],
        },
        {
          id: 'yasak',
          title: '4. Prohibited use',
          body: [
            'You may not upload unlawful, misleading or hateful content, or content that infringes others’ rights.',
            'You may not try to bypass security, access other users’ data or overload the service.',
            'We may suspend or close accounts that break these rules.',
          ],
        },
        {
          id: 'paketler',
          title: '5. Plans and payment',
          body: [
            'Paid plans are a one-time payment valid for one year; nothing renews automatically. When a plan ends your account returns to Free and your data is kept.',
            'Prices are shown in Turkish lira including VAT. Web payments are taken by iyzico; in-app payments by Apple or Google.',
            'A plan is a digital service activated on your account as soon as payment is confirmed. Under Article 15(1)(ğ) of the Turkish Distance Contracts Regulation, there is no right of withdrawal for digital services performed instantly; if a technical problem prevents you from using the service, write to info@invitefolk.com and we will consider a refund. Store purchases are refunded under Apple’s or Google’s rules.',
          ],
        },
        {
          id: 'icerik',
          title: '6. Your content',
          body: [
            'Invitation designs and texts you upload remain yours. You allow us to store them and show them to your guests in order to provide the service.',
            'Only upload images you have the right to use.',
          ],
        },
        {
          id: 'sorumluluk',
          title: '7. Limitation of liability',
          body: [
            'We are not responsible for outages or delivery problems in third-party services such as WhatsApp, email or app stores.',
            'To the extent permitted by law, we are not liable for indirect losses; our liability is limited to the amount you paid in the last 12 months.',
          ],
        },
        {
          id: 'hukuk',
          title: '8. Governing law',
          body: ['These terms are governed by the laws of the Republic of Türkiye. For consumer matters, Consumer Arbitration Committees and Consumer Courts have jurisdiction.', '[Company Name], [Address], [MERSIS no.], info@invitefolk.com.'],
        },
      ],
    },
    kvkk: {
      title: 'KVKK Privacy Notice',
      intro: 'Under Article 10 of Turkey’s Personal Data Protection Law No. 6698 ("KVKK"), [Company Name] ("Invitefolk") explains how we process your personal data.',
      sections: [
        {
          id: 'sorumlu',
          title: '1. Data controller and processor',
          body: [
            'Data controller for organiser account data: [Company Name], [Address], [Registered e-mail (KEP)], info@invitefolk.com.',
            'For guest data, the data controller is the organiser who sent the invitation. Invitefolk processes that data as a data processor, on the organiser’s behalf and instructions.',
          ],
        },
        {
          id: 'kategoriler',
          title: '2. Categories of data',
          body: [
            'Identity: full name.',
            'Contact: email, phone number.',
            'Customer transactions: event details, replies, menu choice, notes, answers to custom questions, table, message delivery statuses.',
            'Finance: plan purchased, amount and payment reference (no card data).',
            'Transaction security: sign-in records, device notification token, audit logs.',
          ],
        },
        {
          id: 'amac-hukuki',
          title: '3. Purposes and legal bases (KVKK Art. 5)',
          body: [
            'Performance of the service contract (Art. 5/2-c): account, events, sending invitations, collecting replies, seating plans.',
            'Compliance with legal obligations (Art. 5/2-ç): invoicing and accounting records.',
            'Legitimate interest (Art. 5/2-f): service security, abuse prevention, troubleshooting.',
            'Guest data is processed for the purpose set by the organiser (inviting and tracking attendance) on the legal basis the organiser relies on.',
          ],
        },
        {
          id: 'aktarim',
          title: '4. Transfers (KVKK Art. 8 and 9)',
          body: [
            'To provide the service, data is transferred to these providers: Supabase Inc. (database and hosting; data region: [EU – Frankfurt]), Meta Platforms Ireland Ltd. (WhatsApp Business), Netgsm İletişim A.Ş. (SMS, in Turkey), Resend Inc. (email), 650 Industries Inc. / Expo (mobile notifications), Cloudflare Inc. (web hosting), RevenueCat Inc., Apple and Google (in-app purchases), iyzico Ödeme Hizmetleri A.Ş. (web payments, in Turkey).',
            'Transfers abroad are made under KVKK Art. 9 using the standard contracts published by the Board, which are notified to the Board within the required period. [Lawyer review: confirm the transfer basis for each provider.]',
            'Data may be shared with competent public authorities where legally required.',
          ],
        },
        {
          id: 'yontem',
          title: '5. How data is collected',
          body: [
            'Electronically and automatically: through information entered by organisers in the app and website, replies given by guests on the invitation page and WhatsApp buttons, Excel/CSV imports, and contacts selected from the phone’s address book with the organiser’s permission.',
          ],
        },
        {
          id: 'saklama',
          title: '6. Retention',
          body: [
            'Account and event data are kept until the account or event is deleted; financial records for the periods required by law (5 years under the Tax Procedure Law, 10 years under the Turkish Commercial Code). Afterwards, data is deleted, destroyed or anonymised.',
          ],
        },
        {
          id: 'haklar',
          title: '7. Your rights (KVKK Art. 11)',
          body: [
            'You have the right to learn whether your data is processed and request information about it, learn the purpose of processing and whether it is used accordingly, know the third parties it is transferred to, request correction of incomplete or inaccurate data, request deletion or destruction under KVKK Art. 7, request that these actions be notified to third parties, object to a result against you arising from automated analysis, and claim compensation for damage caused by unlawful processing.',
            'Send requests to info@invitefolk.com or in writing to [Address]. Requests are concluded free of charge within 30 days at the latest.',
            'If you are a guest, you can first contact the organiser who invited you; we will forward any request we receive to the organiser and help resolve it.',
          ],
        },
      ],
    },
  },
};
