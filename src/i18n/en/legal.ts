// Legal texts. DRAFT: have a lawyer review before publishing. Invitefolk is run by an individual (no company yet);
// fill in the [bracketed] name and postal address.
import type { legal as TR } from '../tr/legal';

export const legal: typeof TR = {
  back: 'Back',
  contents: 'Contents',
  lastUpdated: 'Last updated: {date}',
  updatedAt: '2026-11-26',
  reviewNote: 'This is a draft. Before publishing, the data controller’s name and postal address must be filled in and it must be reviewed by a lawyer. If the Turkish and English versions differ, the Turkish version prevails.',
  notFoundTitle: 'Page not found',
  notFoundBody: "The legal page you're looking for isn't here. Choose one of the links below.",
  langSwitch: 'Language',
  nav: { gizlilik: 'Privacy Policy', kosullar: 'Terms of Use', kvkk: 'KVKK Notice' },
  footer: '{privacy} · {terms} · {kvkk}',
  docs: {
    gizlilik: {
      title: 'Privacy Policy',
      intro:
        'Invitefolk ("we") is a service that helps event organisers send invitations and lets guests reply. This policy explains what data we process and why, who we share it with, how long we keep it, and your rights. Details under Turkish data protection law are in the KVKK Notice.',
      sections: [
        {
          id: 'roller',
          title: '1. Who is the data controller?',
          body: [
            'Invitefolk is run personally by [Full name] (not through a company). [Full name] is the data controller for organiser account data (name, email, phone, plan and purchase records).',
            'For guest data uploaded by an organiser (guest name, phone, email, replies, table), the organiser is the data controller. We process that data only on the organiser’s behalf and instructions, as a data processor.',
          ],
        },
        {
          id: 'veriler',
          title: '2. What data do we process?',
          body: [
            'Organisers: email address, name, optional phone, language preference, events created, plan and purchase records, a device key for notifications (push token), security logs.',
            'Guests: name, phone and email entered by the organiser; the guest’s reply, party size, menu choice, note and answers to custom questions; the table assigned by the organiser; WhatsApp, SMS and email delivery status; whether the invitation was opened; check-in time at the door; number of children and companions’ names (if the organiser asks); date-poll votes, sign-up list choices, five-a-side teams, goals and votes; photos, videos and voice messages a guest uploads to the album, names and messages written in the guestbook, and what they enter in the info-collection form.',
            'Invitation images, gallery photos, video and music files uploaded by the organiser; gift/IBAN details the organiser marks as public. The app doesn’t collect money; the IBAN is only displayed.',
            'Error reports: when the app crashes or an error occurs, the error text, app version, device and browser type. Invitation links, email addresses and phone numbers are removed before sending; no user identity is attached.',
            'We never see or store card details. Plans are bought through the App Store or Google Play with your Apple or Google account.',
            'We don’t track you for advertising, sell data, or use third-party advertising or analytics tools.',
          ],
        },
        {
          id: 'yuz',
          title: '3. Face suggestions (finding photos with a selfie)',
          body: [
            'If the organiser turns it on, guests viewing a public album can choose a selfie to see album photos that look like them. This feature is optional and only works after the guest gives explicit consent.',
            'Face data (face vectors computed from the selfie and album photos — biometric data) is processed only on the guest’s own device and kept only on that device for at most 30 days. It is never sent to our servers, to the organiser or anywhere else; neither we nor the organiser can see it.',
            'A guest can withdraw consent at any time with "Delete my face data", which removes all face data from the device. If the organiser turns the feature off it stops immediately.',
          ],
        },
        {
          id: 'amac',
          title: '4. Why do we process it?',
          body: [
            'To provide the service: account and sign-in, events and guest lists, sending invitations, collecting replies, seating plans, albums and guestbooks.',
            'Plan management and legal obligations.',
            'Security and reliability: preventing abuse and automated (bot) sign-ups, rate limits, audit logs, error tracking.',
            'Notifications: telling the organiser when a guest replies and a daily summary email (can be turned off in settings).',
          ],
        },
        {
          id: 'paylasim',
          title: '5. Who do we share it with?',
          body: [
            'Only as needed to provide the service, with these providers: Supabase (database, authentication, file storage and server functions; data region EU – Frankfurt), Meta Platforms (WhatsApp Business messages), Netgsm (SMS), an email delivery provider (Resend or Brevo), Open-Meteo (weather forecast for the venue; no personal data is sent), Expo (mobile notifications), Cloudflare (web hosting and Turnstile verification against automated sign-ups), Sentry (error tracking, with personal data removed), RevenueCat, Apple and Google (in-app purchases).',
            'Some of these providers are outside Türkiye; transfers are made in line with Article 9 of the KVKK (details in the KVKK Notice).',
            'We don’t share data with anyone, including authorities, unless legally required.',
          ],
        },
        {
          id: 'guvenlik',
          title: '6. How do we protect it?',
          body: [
            'Each organiser can only see their own data; this rule is enforced in the database. Even the platform administrator cannot see guests’ names or phone numbers, only totals; admin access requires two-step verification.',
            'Connections are encrypted (HTTPS). On phones, session data is kept in the device’s encrypted key store. Guest links contain unguessable random keys; files are kept in private storage and shown only through short-lived signed links.',
          ],
        },
        {
          id: 'saklama',
          title: '7. How long do we keep it?',
          body: [
            'Event and guest data: an event is archived 13 months after its date (the invitation and album pages close) and permanently deleted after 2 years, together with its guest list, replies, album and guestbook files. Events without a date are deleted 30 months after they were created. The organiser can delete them earlier.',
            'Account data: you can permanently delete your account in Settings; this immediately deletes all files you uploaded, your events, guest lists and the contacts in your address book.',
            'Face-suggestion data is kept only on the guest’s device, for at most 30 days.',
            'Purchase records are kept for as long as tax law requires. Copies in backups are deleted within 30 days.',
          ],
        },
        {
          id: 'haklar',
          title: '8. Your rights',
          body: [
            'You have the right to access, correct, delete and object to the processing of your data (KVKK Art. 11). Send requests to info@invitefolk.com.',
            'If you’re a guest with a request about your details, you can contact the organiser who invited you or write to us; we’ll pass your request to the organiser and help.',
          ],
        },
        {
          id: 'cocuklar',
          title: '9. Children',
          body: ['Organiser accounts are only for people aged 18 or over.'],
        },
        {
          id: 'iletisim',
          title: '10. Contact and changes',
          body: ['[Full name], [Postal address], info@invitefolk.com.', 'We may update this policy; we’ll announce important changes in the app.'],
        },
      ],
    } as (typeof TR)['docs']['gizlilik'],
    kosullar: {
      title: 'Terms of Use',
      intro: 'By using Invitefolk you accept these terms. Please read them carefully. The service is run personally by [Full name].',
      sections: [
        {
          id: 'hizmet',
          title: '1. The service',
          body: [
            'Invitefolk offers tools to create events, design invitations, send invitations by WhatsApp, email and link, collect replies, plan seating, and run a photo album and guestbook.',
            'We may change features to improve the service. We don’t guarantee uninterrupted or error-free operation; we take reasonable care.',
          ],
        },
        {
          id: 'hesap',
          title: '2. Account',
          body: [
            'You must be 18 or over to open an account. Sign-in uses a one-time code sent to your email; you are responsible for the security of your email account.',
            'You can permanently delete your account at any time in Settings.',
          ],
        },
        {
          id: 'davetliler',
          title: '3. Guest data and permission',
          body: [
            'You are the data controller for the people you add to your guest list. You confirm you have the legal basis needed to send them invitations.',
            'If you make the album public, anyone who knows the table QR code can upload photos, videos and messages. By default uploads are not published until you approve them; if you turn approval off, you are responsible for what is published.',
            'You may not use the service for unsolicited bulk messages (spam), advertising or anything other than invitations. WhatsApp Business and email providers’ rules must be followed.',
          ],
        },
        {
          id: 'yasak',
          title: '4. Prohibited use',
          body: [
            'You may not upload unlawful, misleading or hateful content, or content that infringes others’ rights.',
            'You may not try to bypass security, access other users’ data or overload the service.',
            'If you break these rules we may suspend or close your account.',
          ],
        },
        {
          id: 'paketler',
          title: '5. Plans and payment',
          body: [
            'Plans are bought in the app through the App Store or Google Play; a plan bought with the same account is also unlocked on the web dashboard. Prices are as shown in the store.',
            'Paid plans are a one-off payment and last at least one year. If the first date entered for an event created during the plan is further away, the plan lasts until six months after that event; this is worked out once and is at most two years from purchase. Nothing renews automatically.',
            'An event slot in your plan is not given back when you delete an event that already has guests; it is given back if you delete the event before adding any guests.',
            'When upgrading, you only pay the difference between plan prices and your dates stay the same. The memory album add-on stays open for at least one year and until one year after your event (at most two and a half years from purchase).',
            'When a plan ends your account returns to Free; data is kept until the retention periods in section 7 end.',
            'A plan is a digital service activated on your account as soon as payment is confirmed. Under Article 15(1)(ğ) of the Turkish Distance Contracts Regulation, there is no right of withdrawal for digital services performed instantly. Store purchases are refunded under Apple’s or Google’s rules; if a technical problem prevents you from using the service, write to info@invitefolk.com.',
          ],
        },
        {
          id: 'icerik',
          title: '6. Content',
          body: [
            'Invitation designs and texts you upload belong to you. You allow us to store them and show them to your guests in order to provide the service.',
            'Only upload images belonging to others if you have the right to use them.',
          ],
        },
        {
          id: 'saklama',
          title: '7. Retention',
          body: ['Events are archived 13 months after their date and permanently deleted after 2 years with all guest data and files (details in the Privacy Policy). Download any photos and lists you want to keep before then.'],
        },
        {
          id: 'sorumluluk',
          title: '8. Limitation of liability',
          body: [
            'We are not responsible for outages or delivery problems in third-party services such as WhatsApp, email and the app stores.',
            'To the extent permitted by law, we are not liable for indirect losses; our liability is limited to the amount you paid in the last 12 months.',
          ],
        },
        {
          id: 'hukuk',
          title: '9. Governing law',
          body: ['These terms are governed by the laws of the Republic of Türkiye. For consumer matters, Consumer Arbitration Committees and Consumer Courts have jurisdiction.', '[Full name], [Postal address], info@invitefolk.com.'],
        },
      ],
    } as (typeof TR)['docs']['kosullar'],
    kvkk: {
      title: 'KVKK Notice',
      intro: 'Under Article 10 of Turkish Personal Data Protection Law No. 6698 ("KVKK"), [Full name], who runs Invitefolk, explains how your personal data is processed.',
      sections: [
        {
          id: 'sorumlu',
          title: '1. Data controller and data processor',
          body: [
            'Data controller for organiser account data: [Full name] (an individual), [Postal address], info@invitefolk.com.',
            'For guest data, the data controller is the organiser who sends the invitation. Invitefolk processes that data on the organiser’s behalf and instructions, as a data processor.',
          ],
        },
        {
          id: 'kategoriler',
          title: '2. Categories of data',
          body: [
            'Identity: full name.',
            'Contact: email, phone number.',
            'Customer transaction: event details, replies, menu choice, notes, answers to custom questions, table, message delivery status.',
            'Visual and audio records: photos, videos and sound recordings uploaded by organisers and guests.',
            'Finance: plan purchased, amount and store transaction reference (no card data is processed).',
            'Transaction security: sign-in logs, device notification key, audit logs, error reports with personal data removed.',
            'Biometric data: in the face-suggestion feature, face vectors are processed only on the guest’s own device with their explicit consent; they are not transferred to or stored by us.',
          ],
        },
        {
          id: 'amac-hukuki',
          title: '3. Purposes and legal grounds (KVKK Art. 5 and 6)',
          body: [
            'Performance of the service contract (Art. 5/2-c): account, events, sending invitations, collecting replies, seating plans, albums.',
            'Compliance with legal obligations (Art. 5/2-ç): records required by law.',
            'Legitimate interest (Art. 5/2-f): service security, preventing abuse and automated sign-ups, error tracking and fixing.',
            'Explicit consent (Art. 6): biometric processing on the guest’s device in the face-suggestion feature. Consent can be withdrawn at any time. [Lawyer to review: confirm the controller and the scope of consent for on-device processing.]',
            'Guest data is processed for the purpose set by the organiser (invitations and attendance) and on the legal ground the organiser relies on.',
          ],
        },
        {
          id: 'aktarim',
          title: '4. Transfers (KVKK Art. 8 and 9)',
          body: [
            'To provide the service, data is transferred to these providers: Supabase Inc. (database, files and hosting; data region: EU – Frankfurt), Meta Platforms Ireland Ltd. (WhatsApp Business), Netgsm İletişim A.Ş. (SMS, in Türkiye), Resend Inc. or Sendinblue SAS / Brevo (email), 650 Industries Inc. / Expo (mobile notifications), Cloudflare Inc. (web hosting and bot verification), Functional Software Inc. / Sentry (error tracking), RevenueCat Inc., Apple and Google (in-app purchases).',
            'Transfers abroad are made under the standard contracts announced by the Board under KVKK Art. 9, and the Board is notified of them within the required period. [Lawyer to review: confirm the transfer basis for each provider.]',
            'Data may be transferred to authorised public bodies where required by law.',
          ],
        },
        {
          id: 'yontem',
          title: '5. How data is collected',
          body: [
            'Data is collected electronically through the app and website: details entered by the organiser, replies and WhatsApp button answers from guests, album and guestbook uploads, Excel/CSV imports, and contacts the organiser chooses from their phone with permission.',
          ],
        },
        {
          id: 'saklama',
          title: '6. Retention',
          body: [
            'Event and guest data is deleted with its files 2 years after the event date (30 months after creation for events without a date); before that, the event is archived 13 months after its date. Account data is kept until the account is deleted. Financial records are kept for the period required by law. At the end of the period, data is deleted, destroyed or anonymised.',
          ],
        },
        {
          id: 'haklar',
          title: '7. Your rights (KVKK Art. 11)',
          body: [
            'You have the right to learn whether your data is processed, request information, learn the purpose and whether it is used accordingly, know the third parties it is transferred to, request correction, request deletion or destruction under KVKK Art. 7, request that these actions be notified to third parties, object to a result against you arising from automated analysis, and claim compensation for unlawful processing.',
            'Send requests to info@invitefolk.com or in writing to [Postal address]. Requests are concluded free of charge within 30 days at the latest.',
            'If you are a guest, you may first contact the organiser who invited you; we’ll pass requests we receive to the organiser and help resolve them.',
          ],
        },
      ],
    } as (typeof TR)['docs']['kvkk'],
  },
};
