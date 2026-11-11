export type CategoryKind = 'event' | 'place';

export interface EventCategory {
  /** The category's number. Used later to learn what each student likes. */
  id: number;
  name: string;
  active: boolean;
  kind: CategoryKind;
}

export interface EventItem {
  id: string;
  name: string;
  description: string;
  categoryId: number | null;
  startsAt: string;
  expiresAt: string;
  locationText: string;
  imagePath: string | null;
  /** Who to contact about the event. Any of these may be empty. */
  contactName: string;
  contactPhone: string;
  contactLink: string;
  published: boolean;
  createdAt: string;
}

export interface EventInput {
  name: string;
  description: string;
  categoryId: number | null;
  startsAt: string;
  expiresAt: string;
  locationText: string;
  imagePath: string | null;
  contactName: string;
  contactPhone: string;
  contactLink: string;
  published: boolean;
}
