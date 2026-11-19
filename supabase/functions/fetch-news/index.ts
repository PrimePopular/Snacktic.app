// Fetches trending stories into the news_items table. Paste this whole file into a Supabase Edge Function named "fetch-news"
// (see docs/NEWS_SOURCES.md) and call it every 30 minutes with the header x-news-secret. It uses only sources whose terms allow it:
//   - YouTube: the official Data API, "most popular" in your country (1 quota unit per call out of 10,000 free a day).
//   - RSS: headlines and links from news sites that publish a public feed.
// Reddit and X are not used: Reddit's free access is non-commercial only and X charges per read.
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const SECRET = Deno.env.get('NEWS_SECRET') ?? '';
const YT_KEY = Deno.env.get('YOUTUBE_API_KEY') ?? '';
const REGION = Deno.env.get('YOUTUBE_REGION') ?? 'NG';
const FEEDS = (Deno.env.get('NEWS_RSS_FEEDS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const KEEP_DAYS = 7;

interface Item { source: 'youtube' | 'rss'; source_name: string; title: string; summary: string; image_url: string | null; url: string; score: number; published_at: string }

const clean = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;|&gt;/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))?.[1] ?? '';

async function youtube(): Promise<Item[]> {
  if (!YT_KEY) return [];
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=${REGION}&maxResults=25&key=${YT_KEY}`);
  if (!res.ok) return [];
  const body = await res.json();
  return (body.items ?? []).map((v: any): Item => {
    const views = Number(v.statistics?.viewCount ?? 0);
    const thumbs = v.snippet?.thumbnails ?? {};
    return {
      source: 'youtube', source_name: v.snippet?.channelTitle ?? 'YouTube', title: clip(clean(v.snippet?.title ?? ''), 240),
      summary: clip(clean(v.snippet?.description ?? ''), 280), image_url: (thumbs.high ?? thumbs.medium ?? thumbs.default)?.url ?? null,
      url: `https://www.youtube.com/watch?v=${v.id}`, score: Math.log10(views + 1) * 10, published_at: v.snippet?.publishedAt ?? new Date().toISOString(),
    };
  });
}

async function rss(feed: string): Promise<Item[]> {
  const res = await fetch(feed, { headers: { 'user-agent': 'SnackticNews/1.0' } });
  if (!res.ok) return [];
  const xml = await res.text();
  const channel = clean(tag(xml, 'title')) || new URL(feed).hostname;
  return (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []).slice(0, 15).map((it): Item | null => {
    const title = clean(tag(it, 'title')); const link = clean(tag(it, 'link'));
    if (!title || !/^https?:\/\//.test(link)) return null;
    const when = new Date(clean(tag(it, 'pubDate'))); const t = isNaN(when.getTime()) ? new Date() : when;
    const img = it.match(/<media:(?:thumbnail|content)[^>]*url="([^"]+)"/i)?.[1] ?? it.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/i)?.[1] ?? null;
    const hoursOld = (Date.now() - t.getTime()) / 3_600_000;
    return { source: 'rss', source_name: channel, title: clip(title, 240), summary: clip(clean(tag(it, 'description')), 280), image_url: img, url: link, score: Math.max(0, 60 - hoursOld), published_at: t.toISOString() };
  }).filter((x): x is Item => x !== null);
}

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get('x-news-secret') !== SECRET) return new Response('Not allowed', { status: 401 });
  const batches = await Promise.allSettled([youtube(), ...FEEDS.map(rss)]);
  const items = batches.flatMap((b) => (b.status === 'fulfilled' ? b.value : []));
  if (items.length) {
    const { error } = await admin.from('news_items').upsert(items.map((i) => ({ ...i, fetched_at: new Date().toISOString() })), { onConflict: 'url', ignoreDuplicates: false });
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  await admin.from('news_items').delete().lt('published_at', new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString());
  return Response.json({ ok: true, saved: items.length });
});
