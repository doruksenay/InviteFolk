import type { eventTypes as TR } from '../tr/eventTypes';

const RSVP = { yes: "I'll be there", no: "Can't make it", askParty: 'Wonderful! How many of you are coming?' };

export const eventTypes: typeof TR = {
  dugun: {
    name: 'Wedding',
    description: 'Invitations, RSVPs and seating in one place.',
    rsvp: RSVP,
    menu: ['Meat', 'Fish', 'Vegetarian', "Kids' menu"],
    features: [
      { title: 'Seating plan', detail: 'Set up tables and seat guests in one tap.' },
      { title: 'Henna night and wedding, one contact list', detail: 'Upload your list once and invite to the henna night in one tap.' },
      { title: 'Menu choices', detail: 'Meat, fish and vegetarian counts, ready for the venue.' },
    ],
    sample: { greet: 'Dear Ahmet Yılmaz and family', kicker: "We're getting married", title: 'Ayşe\n& Mehmet', line: 'We would love for you to be with us on the happiest day of our lives.', when: 'Saturday, 12 June 2027 · 7 pm', where: 'Kalamış Davet Salonu, Kadıköy', deadline: '1 May', host: 'A', wa: 'Ayşe and Mehmet invite you to their wedding.' },
  },
  nisan: {
    name: 'Engagement',
    description: 'Warm, family-centred and intimate.',
    rsvp: RSVP,
    menu: null,
    features: [
      { title: 'Family groups', detail: 'Track the bride\'s and groom\'s sides separately.' },
      { title: 'Guest limit', detail: 'Set how many people each household can bring.' },
      { title: 'Automatic reminders', detail: 'Nudges guests who haven\'t replied yet.' },
    ],
    sample: { greet: 'Dear Ahmet Yılmaz and family', kicker: "We're engaged", title: 'Ayşe\n& Mehmet', line: 'We would like to share this happy moment with you and our families.', when: 'Saturday, 20 March 2027 · 5 pm', where: '[Venue], Üsküdar', deadline: '1 March', host: 'A', wa: 'Ayşe and Mehmet invite you to their engagement.' },
  },
  kina: {
    name: 'Henna night',
    description: 'Uses the same guest list as the wedding.',
    rsvp: RSVP,
    menu: null,
    features: [
      { title: 'Add from the wedding list', detail: 'Invite the same guests to a second event in one tap.' },
      { title: 'Your own invitation design', detail: 'Upload your image and each guest\'s name is written on it.' },
      { title: 'Automatic reminders', detail: 'Nudges guests who haven\'t replied yet.' },
    ],
    sample: { greet: 'Dear Ahmet Yılmaz and family', kicker: 'Henna night', title: "Ayşe's\nhenna night", line: 'We want our loved ones by our side as we light the henna.', when: 'Friday, 11 June 2027 · 8 pm', where: '[Venue], Üsküdar', deadline: '25 May', host: 'A', wa: 'Ayşe invites you to her henna night.' },
  },
  dogum: {
    name: 'Birthday',
    description: 'A warm invitation, ready in minutes.',
    rsvp: { yes: "I'm in", no: "Can't make it", askParty: 'Great! Bringing anyone along?' },
    menu: null,
    features: [
      { title: 'Ready in minutes', detail: 'Date, place and list; the rest is automatic.' },
      { title: 'Plus one', detail: 'Guests can bring someone along.' },
      { title: 'Gift note', detail: 'Show a short note on the invitation if you like.' },
    ],
    sample: { greet: 'Hi [Guest name],', kicker: 'Turning 30', title: "Deniz's\nbirthday", line: 'No gifts, just you. Come celebrate with us.', when: 'Saturday, 8 May 2027 · 8 pm', where: '[Venue], Moda', deadline: '1 May', host: 'D', wa: 'Deniz is inviting you to a birthday party.' },
  },
  yemek: {
    name: 'Dinner party',
    description: 'With menu choices and a guest limit.',
    rsvp: RSVP,
    menu: ['Meat', 'Fish', 'Vegetarian'],
    features: [
      { title: 'Menu choices', detail: 'Meat, fish or vegetarian.' },
      { title: 'Guest limit', detail: 'Set how many people each household can bring.' },
      { title: 'Allergy notes', detail: 'Guests can tell you about special requests.' },
    ],
    sample: { greet: 'Dear [Guest name]', kicker: 'Dinner', title: 'Join us\non Saturday', line: "We're setting the table; the conversation is up to you.", when: 'Saturday, 13 March 2027 · 8 pm', where: "Ece and Can's place, Cihangir", deadline: '6 March', host: 'E', wa: 'Ece and Can invite you to dinner.' },
  },
  kurumsal: {
    name: 'Corporate',
    description: 'Launches, galas and meetings.',
    rsvp: RSVP,
    menu: null,
    features: [
      { title: 'Group labels', detail: 'Organise your list by company or team.' },
      { title: 'Your own questions', detail: 'Ask attendees for whatever you need.' },
      { title: 'Bulk email', detail: 'Corporate email alongside WhatsApp.' },
    ],
    sample: { greet: 'Dear [Guest name]', kicker: "You're invited", title: 'Dealer\nmeeting 2027', line: "Let's talk about the plans for the new season together.", when: 'Sunday, 4 April 2027 · 10 am', where: '[Hotel], Şişli', deadline: '25 March', host: 'C', wa: '[Company] invites you to the dealer meeting.' },
  },
  saha: {
    name: 'Football match',
    description: 'Squad, waitlist and weekly repeat.',
    rsvp: { yes: "I'm in", no: 'Not this week', askParty: 'Great! Shall I add you to the waitlist too?' },
    menu: null,
    features: [
      { title: 'Squad and waitlist', detail: 'When the squad is full, the waitlist lines up.' },
      { title: 'Every week, automatically', detail: 'After the match a new week opens and the invite goes out by itself.' },
      { title: 'Who paid', detail: 'Track the pitch fee person by person.' },
    ],
    sample: { greet: 'Hey [Guest name],', kicker: 'Thursday game', title: 'Five-a-side\n9 pm', line: "Your spot in the squad is ready, let's not be short.", when: 'Every Thursday · 9–10 pm', where: '[Pitch], Ataşehir', deadline: 'Wednesday 6 pm', host: 'B', wa: 'Burak is calling you to the Thursday game.' },
  },
  diger: {
    name: 'Something else',
    description: 'Graduation, party or a get-together.',
    rsvp: RSVP,
    menu: null,
    features: [
      { title: 'Your own questions', detail: 'Ask guests whatever you need.' },
      { title: 'Automatic reminders', detail: 'Goes out to anyone who hasn\'t replied.' },
      { title: 'WhatsApp and email', detail: 'Reach everyone on their easiest channel.' },
    ],
    sample: { greet: 'Dear [Guest name]', kicker: "You're invited", title: '[Event\nname]', line: 'We would love to have you with us on this lovely day.', when: '[Date] · [Time]', where: '[Venue]', deadline: '[Date]', host: 'H', wa: '[Host] is inviting you.' },
  },
};
