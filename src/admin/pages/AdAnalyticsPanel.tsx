import { useEffect, useState } from 'react';
import { ownerAdAnalytics, ownerAdDaily } from '../../features/ads';
import type { Ad, AdAnalytics, AdDay } from '../../features/ads';
import { Button, Card, SelectField } from '../../shared/components';

const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const n = (v: number) => v.toLocaleString();

/** Plain-text report for one campaign. Totals only, no student identities, so it is safe to send to the advertiser. */
function advertiserReport(ad: Ad, a: AdAnalytics, days: number): string {
  return [
    `Snacktic campaign report: ${ad.title}`,
    ad.advertiser ? `Advertiser: ${ad.advertiser}` : '',
    `Period: last ${days} days`,
    '',
    `Total impressions: ${n(a.impressions)}`,
    `Unique reach: ${n(a.reach)}`,
    `Total clicks: ${n(a.clicks)}`,
    `Unique clicks: ${n(a.uniqueClicks)}`,
    `Click-through rate: ${a.ctr}%`,
  ]
    .filter((l) => l !== '')
    .join('\n');
}

/**
 * Campaign performance for the owner: impressions, unique reach, clicks, unique clicks, CTR, Crumb Points paid and activity over
 * time. "Copy advertiser report" gives totals only, never student identities.
 */
export function AdAnalyticsPanel({ ads }: { ads: Ad[] }) {
  const [days, setDays] = useState('30');
  const [stats, setStats] = useState<Record<string, AdAnalytics> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [daily, setDaily] = useState<AdDay[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setStats(null);
    setError(null);
    ownerAdAnalytics(Number(days))
      .then((s) => active && setStats(s))
      .catch((e: unknown) => active && setError(e instanceof Error ? `${e.message}. Has supabase/027 been run?` : 'Something went wrong.'));
    return () => {
      active = false;
    };
  }, [days]);

  async function show(id: string) {
    if (open === id) return setOpen(null);
    setOpen(id);
    setDaily(null);
    setDaily(await ownerAdDaily(id, Number(days)).catch(() => []));
  }

  async function copy(ad: Ad, a: AdAnalytics) {
    try {
      await navigator.clipboard.writeText(advertiserReport(ad, a, Number(days)));
      setCopied(ad.id);
    } catch {
      setCopied(null);
    }
  }

  const peak = Math.max(1, ...(daily ?? []).map((d) => d.views));

  return (
    <details className="ann__item">
      <summary>
        <strong>Campaign analytics</strong>
      </summary>
      <Card as="div" className="ann__item">
        <p className="text-secondary text-small">Impressions count every time an ad is seen. Unique reach counts each person once. Unique clicks count each person once, however many times they tap.</p>
        <SelectField label="Period" value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="3650">All time</option>
        </SelectField>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!stats && !error && <p className="text-secondary">Loading…</p>}
        {stats && (
          <ul className="activity-list">
            {ads.map((ad) => {
              const a = stats[ad.id];
              if (!a) return null;
              return (
                <li key={ad.id} className="activity-row">
                  <button type="button" className="link-button" onClick={() => void show(ad.id)} aria-expanded={open === ad.id}>
                    {ad.title}
                  </button>
                  <span className="text-xs text-secondary">
                    {n(a.impressions)} impressions · {n(a.reach)} reached · {n(a.clicks)} clicks · {n(a.uniqueClicks)} unique clicks · CTR {a.ctr}% · {n(a.pointsPaid)} Crumb Points paid to {n(a.studentsPaid)} students
                  </span>
                  {open === ad.id && (
                    <div>
                      {!daily ? (
                        <p className="text-small">Loading…</p>
                      ) : daily.length === 0 ? (
                        <p className="text-small text-secondary">No activity in this period.</p>
                      ) : (
                        <ul className="activity-list">
                          {daily.map((d) => (
                            <li key={d.day} className="activity-row">
                              <span className="text-xs">{dayFmt.format(new Date(d.day))}</span>
                              <span aria-hidden="true" style={{ display: 'block', height: 8, width: `${Math.max(2, (d.views / peak) * 100)}%`, background: 'var(--color-orange)', borderRadius: 4 }} />
                              <span className="text-xs text-secondary">
                                {n(d.views)} views · {n(d.clicks)} clicks
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button variant="secondary" onClick={() => void copy(ad, a)}>
                        {copied === ad.id ? 'Copied' : 'Copy advertiser report'}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </details>
  );
}
