import type { home as TR } from '../tr/home';

export const home: typeof TR = {
  hello: 'Hello',
  summary: { one: 'You have {count} event', other: 'You have {count} events' },
  summaryPending: { one: ', {count} household still to reply', other: ', {count} households still to reply' },
  firstInvite: 'Get your first invitation ready in a few minutes.',
  newEvent: 'New event',
  loadFailed: "We couldn't load your events. Check your connection and try again.",
  emptyTitle: 'Create your first invitation',
  emptyBody: "A wedding, a birthday or Thursday's match. Pick the type, add your list, and we'll keep track of the rest.",
  card: {
    noDetails: 'No date or venue yet',
    noGuests: 'No guests yet',
    attending: { one: '{count} person coming', other: '{count} people coming' },
    pending: { one: '{count} household pending', other: '{count} households pending' },
    barLabel: 'Of {total} households, {yes} attending, {no} declined, {pending} pending',
  },
  brand: {
    adminBadge: 'ADMIN',
    contacts: 'Contacts',
    plans: 'Plans',
  },
  showArchived: 'Archive',
  archivedCount: { one: 'Showing {count} archived event', other: 'Showing {count} archived events' },
  limit: {
    events: 'Your plan includes {max} events and you’re using {used}.',
    contacts: 'You have {used} of {max} contacts.',
    cta: 'See plans',
  },
};
