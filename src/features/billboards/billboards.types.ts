export type BillboardLayout = 'text' | 'image' | 'gallery' | 'video' | 'link' | 'quote';
export type BillboardStatus = 'draft' | 'published' | 'archived';

export interface BillboardPost {
  id: string;
  layout: BillboardLayout;
  title: string;
  body: string;
  images: string[];
  videoUrl: string | null;
  linkUrl: string | null;
  linkLabel: string;
  featured: boolean;
  status: BillboardStatus;
  publishAt: string;
  expiresAt: string | null;
  createdAt: string;
}

export type BillboardInput = Omit<BillboardPost, 'id' | 'createdAt'>;

export const layoutLabels: Record<BillboardLayout, string> = {
  text: 'Text post',
  image: 'Big picture',
  gallery: 'Swipeable pictures',
  video: 'Video',
  link: 'Link card',
  quote: 'Quote or story',
};

/** Every post stays up at least this long. The database enforces it too. */
export const MIN_VISIBLE_DAYS = 30;
