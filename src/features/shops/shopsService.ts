/**
 * Shops around campus and the partner products they carry. Written by admins, read by everyone.
 * The database (Row Level Security) decides who may do what, not this file.
 */
import { supabase } from '../../services/database';
import { cached } from '../../services/offlineCache';
import { removePicture } from '../../services/pictures';
import type { Shop, ShopInput, ShopProduct, ShopProductInput } from './shops.types';

const SHOP_COLUMNS = 'id, name, description, image_path, address, latitude, longitude, phone, opening_hours, published, created_at';
const PRODUCT_COLUMNS = 'id, shop_id, name, description, image_path, published';

interface ShopRow {
  id: string;
  name: string;
  description: string;
  image_path: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  opening_hours: string;
  published: boolean;
  created_at: string;
}

interface ProductRow {
  id: string;
  shop_id: string;
  name: string;
  description: string;
  image_path: string | null;
  published: boolean;
}

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

const productFromRow = (r: ProductRow): ShopProduct => ({
  id: r.id,
  shopId: r.shop_id,
  name: r.name,
  description: r.description,
  imagePath: r.image_path,
  published: r.published,
});

const shopFromRow = (r: ShopRow, products: ProductRow[]): Shop => ({
  id: r.id,
  name: r.name,
  description: r.description,
  imagePath: r.image_path,
  address: r.address,
  latitude: r.latitude,
  longitude: r.longitude,
  phone: r.phone,
  openingHours: r.opening_hours,
  published: r.published,
  createdAt: r.created_at,
  products: products.filter((p) => p.shop_id === r.id).map(productFromRow),
});

const shopToRow = (i: ShopInput) => ({
  name: i.name.trim(),
  description: i.description.trim(),
  image_path: i.imagePath,
  address: i.address.trim(),
  latitude: i.latitude,
  longitude: i.longitude,
  phone: i.phone.trim(),
  opening_hours: i.openingHours.trim(),
  published: i.published,
});

const productToRow = (i: ShopProductInput) => ({
  name: i.name.trim(),
  description: i.description.trim(),
  image_path: i.imagePath,
  published: i.published,
});

async function load(onlyPublished: boolean): Promise<{ shops: ShopRow[]; products: ProductRow[] }> {
  let shopQuery = client().from('shops').select(SHOP_COLUMNS).order('created_at', { ascending: false });
  let productQuery = client().from('shop_products').select(PRODUCT_COLUMNS).order('created_at', { ascending: true });
  if (onlyPublished) {
    shopQuery = shopQuery.eq('published', true);
    productQuery = productQuery.eq('published', true);
  }
  const [shops, products] = await Promise.all([shopQuery, productQuery]);
  if (shops.error) throw new Error(shops.error.message);
  if (products.error) throw new Error(products.error.message);
  return { shops: (shops.data ?? []) as ShopRow[], products: (products.data ?? []) as ProductRow[] };
}

/** Admin view: everything, including hidden shops and products. */
export async function listAllShops(): Promise<Shop[]> {
  const { shops, products } = await load(false);
  return shops.map((s) => shopFromRow(s, products));
}

/** Student view: published shops with their published products. */
export async function listLiveShops(): Promise<Shop[]> {
  const { shops, products } = await cached('shops', () => load(true));
  return shops.map((s) => shopFromRow(s, products));
}

export async function createShop(input: ShopInput): Promise<void> {
  const { error } = await client().from('shops').insert(shopToRow(input));
  if (error) throw new Error(error.message);
}

export async function updateShop(id: string, input: ShopInput): Promise<void> {
  const { error } = await client().from('shops').update(shopToRow(input)).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setShopPublished(id: string, published: boolean): Promise<void> {
  const { error } = await client().from('shops').update({ published }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteShop(shop: Shop): Promise<void> {
  const { error } = await client().from('shops').delete().eq('id', shop.id);
  if (error) throw new Error(error.message);
  await Promise.all([shop.imagePath, ...shop.products.map((p) => p.imagePath)].filter((p): p is string => Boolean(p)).map((p) => removePicture(p)));
}

export async function createShopProduct(shopId: string, input: ShopProductInput): Promise<void> {
  const { error } = await client().from('shop_products').insert({ shop_id: shopId, ...productToRow(input) });
  if (error) throw new Error(error.message);
}

export async function updateShopProduct(id: string, input: ShopProductInput): Promise<void> {
  const { error } = await client().from('shop_products').update(productToRow(input)).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteShopProduct(product: ShopProduct): Promise<void> {
  const { error } = await client().from('shop_products').delete().eq('id', product.id);
  if (error) throw new Error(error.message);
  if (product.imagePath) await removePicture(product.imagePath);
}
