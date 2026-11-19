export type AnnouncementLevel = 'major' | 'medium' | 'minor';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  level: AnnouncementLevel;
  imagePath: string | null;
  published: boolean;
  /** When it starts showing. Null means straight away. */
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface AnnouncementInput {
  title: string;
  body: string;
  level: AnnouncementLevel;
  imagePath: string | null;
  published: boolean;
  startsAt: string | null;
  expiresAt: string | null;
}

export const levelLabels: Record<AnnouncementLevel, string> = {
  major: 'Major',
  medium: 'Medium',
  minor: 'Minor',
};

export const levelHelp: Record<AnnouncementLevel, string> = {
  major: 'Pinned at the very top of Home. Use for big news.',
  medium: 'Shown in everyone\u2019s Home feed.',
  minor: 'Lower priority. Shown further down.',
};
