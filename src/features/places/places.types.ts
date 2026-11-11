export interface Place {
  id: string;
  name: string;
  description: string;
  categoryId: number | null;
  address: string;
  imagePath: string | null;
  link: string;
  phone: string;
  /** Map position. Both set, or both null. */
  latitude: number | null;
  longitude: number | null;
  published: boolean;
  createdAt: string;
}

export interface PlaceInput {
  name: string;
  description: string;
  categoryId: number | null;
  address: string;
  imagePath: string | null;
  link: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  published: boolean;
}
