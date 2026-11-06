// Organizatör: "albümdeki kişiler". Yalnızca web'de çalışır (yüz işleme tarayıcıda yapılır); uygulamada sekme gösterilmez.
export const PEOPLE_SUPPORTED = false;

export type PeoplePhoto = { id: string; url: string | null };
export type PeoplePanelProps = { eventId: string; photos: PeoplePhoto[]; guestNames: string[] };

export function PeoplePanel(_props: PeoplePanelProps) {
  return null;
}
