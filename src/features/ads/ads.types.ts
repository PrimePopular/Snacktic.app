export interface Ad {
  id: string;
  advertiser: string;
  title: string;
  body: string;
  imagePath: string | null;
  link: string;
  /** Crumb Points a student earns the first time they see this ad (0 to 5, set by the owner). */
  points: number;
  endsAt: string | null;
  published: boolean;
  createdAt: string;
}

export interface AdInput {
  advertiser: string;
  title: string;
  body: string;
  imagePath: string | null;
  link: string;
  points: number;
  endsAt: string | null;
  published: boolean;
}
