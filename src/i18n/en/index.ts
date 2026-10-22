import type { tr } from '../tr';
import { common } from './common';
import { status } from './status';
import { themes } from './themes';
import { errors } from './errors';
import { eventTypes } from './eventTypes';
import { hall } from './hall';
import { auth } from './auth';
import { home } from './home';
import { wizard } from './wizard';
import { event } from './event';
import { seating } from './seating';
import { rsvp } from './rsvp';
import { admin } from './admin';
import { layout } from './layout';
import { settings } from './settings';

export const en: typeof tr = { common, status, themes, errors, eventTypes, hall, auth, home, wizard, event, seating, rsvp, admin, layout, settings };
