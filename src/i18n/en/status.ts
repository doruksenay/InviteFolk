import type { status as TR } from '../tr/status';

export const status: typeof TR = {
  rsvp: { yes: 'Attending', pending: 'Pending', no: 'Declined', maybe: 'Maybe', waitlist: 'Waitlist' },
  delivery: { not_sent: 'Not sent', queued: 'Queued', sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Not delivered' },
  event: { draft: 'Draft', active: 'Active', archived: 'Archived' },
  side: { gelin: "Bride's side", damat: "Groom's side", ortak: 'Shared', none: 'Not set' },
  plan: { free: 'Free', temel: 'Basic', otomatik: 'Automatic', tam: 'Complete', b2b: 'Business' },
};
