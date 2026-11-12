export interface ShopProduct {
  id: string;
  shopId: string;
  name: string;
  description: string;
  imagePath: string | null;
  published: boolean;
}

export interface Shop {
  id: string;
  name: string;
  description: string;
  imagePath: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  openingHours: string;
  published: boolean;
  createdAt: string;
  /** Partner products this shop carries. Filled in by the list functions. */
  products: ShopProduct[];
}

export interface ShopInput {
  name: string;
  description: string;
  imagePath: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  openingHours: string;
  published: boolean;
}

export interface ShopProductInput {
  name: string;
  description: string;
  imagePath: string | null;
  published: boolean;
}
