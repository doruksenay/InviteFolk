import type { auth as TR } from '../tr/auth';

export const auth: typeof TR = {
  headline: 'Every invitation, ',
  headlineAccent: 'one tap away.',
  intro: 'From weddings to Thursday football, send your invitations and follow every reply in one place.',
  email: 'Email',
  emailPlaceholder: 'you@example.com',
  invalidEmail: 'Please enter a valid email address.',
  sendCode: 'Continue with email',
  home: 'Home',
  sendFailed: "We couldn't send the code. Please try again in a moment.",
  newAccountHint: "New here? We'll create your account the first time you sign in.",
  codeSent: 'We sent a sign-in email to {email}. Enter the 6-digit code here, or tap the link in the email in this browser.',
  code: 'Sign-in code',
  codeTooShort: 'Enter the 6-digit code from your email.',
  verifyFailed: "That code didn't work. Check it or request a new one.",
  signIn: 'Sign in',
  changeEmail: 'Use a different email',
  legalNotice: 'By continuing you accept the {terms} and {privacy}. Your personal data is processed as described in the {kvkk}.',
  terms: 'Terms of Use',
  privacy: 'Privacy Policy',
  kvkk: 'KVKK Notice',
};
