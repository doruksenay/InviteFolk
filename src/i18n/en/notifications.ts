import type { notifications as TR } from '../tr/notifications';

export const notifications: typeof TR = {
  channelName: 'Guest replies',
  prompt: {
    title: 'Want a heads-up when guests reply?',
    body: "We'll notify you when someone says yes, can't make it, or moves up from the waitlist.",
    enable: 'Turn on notifications',
    later: 'Not now',
    denied: "Notifications weren't allowed. You can turn them on in your phone's settings.",
  },
  emailNotConfigured: "Email sending isn't set up yet.",
};
