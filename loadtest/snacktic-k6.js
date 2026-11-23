// Snacktic load test (k6). Reads only: the screens students open most. It never writes, signs up, or touches Crumb Points.
//
// Run against a COPY of your project (a second, free Supabase project with the same tables), never your live one:
//   k6 run -e SUPABASE_URL=https://YOUR-TEST-REF.supabase.co -e ANON_KEY=your-test-anon-key -e PEAK=500 loadtest/snacktic-k6.js
// PEAK is the number of students using the app at the same time (try 100, 500, 1000, 2000).
import http from 'k6/http';
import { check, sleep } from 'k6';

const URL = __ENV.SUPABASE_URL;
const KEY = __ENV.ANON_KEY;
const PEAK = Number(__ENV.PEAK || 100);

export const options = {
  stages: [
    { duration: '1m', target: Math.round(PEAK * 0.25) },
    { duration: '2m', target: Math.round(PEAK * 0.6) },
    { duration: '3m', target: PEAK },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],      // fewer than 1 in 100 requests may fail
    http_req_duration: ['p(95)<1000'],   // 95 of 100 requests faster than 1 second
  },
};

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const get = (path) => http.get(`${URL}/rest/v1/${path}`, { headers });

export default function () {
  // What a student does when they open the app: Home, then Discover, Rewards, Billboards.
  const home = [
    get('events?select=id,title,starts_at&order=starts_at.asc&limit=20'),
    get('announcements?select=id,title,level&published=eq.true&order=created_at.desc&limit=20'),
    get('ads?select=id,title&published=eq.true&limit=10'),
  ];
  check(home[0], { 'events ok': (r) => r.status === 200 });
  sleep(2 + Math.random() * 3);

  const discover = [get('places?select=id,name&limit=20'), get('shops?select=id,name&limit=20')];
  check(discover[0], { 'places ok': (r) => r.status === 200 });
  sleep(2 + Math.random() * 3);

  const rewards = [get('rewards?select=id,name,cost_points&active=eq.true&order=cost_points.asc&limit=40'), get('reward_settings?select=signup_bonus,daily_login&limit=1')];
  check(rewards[0], { 'rewards ok': (r) => r.status === 200 });
  sleep(2 + Math.random() * 3);

  const billboards = get('billboard_posts?select=id,title,layout&order=featured.desc,publish_at.desc&limit=8');
  check(billboards, { 'billboards ok': (r) => r.status === 200 });
  sleep(3 + Math.random() * 5);
}
