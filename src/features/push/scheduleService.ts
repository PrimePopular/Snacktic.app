/** The notification schedule the owner edits in Admin, Daily notifications. The server sends what is due (supabase/functions/push). */
import { supabase } from '../../services/database';

export type ScheduleKind = 'weather' | 'prayer' | 'games' | 'custom';
export type Repeat = 'daily' | 'weekdays' | 'weekends';

export interface Schedule {
  id: string;
  kind: ScheduleKind;
  title: string;
  body: string;
  link: string;
  /** Local time, like 06:30. */
  sendTime: string;
  repeat: Repeat;
  /** yyyy-mm-dd or empty. */
  startDate: string;
  endDate: string;
  validMinutes: number;
  enabled: boolean;
}

export type ScheduleInput = Omit<Schedule, 'id'> & { id?: string };

interface Row {
  id: string;
  kind: ScheduleKind;
  title: string;
  body: string;
  link: string;
  send_time: string;
  repeat: Repeat;
  start_date: string | null;
  end_date: string | null;
  valid_minutes: number;
  enabled: boolean;
}

function client() {
  if (!supabase) throw new Error('The database is not connected yet.');
  return supabase;
}

export const kindLabels: Record<ScheduleKind, string> = {
  weather: 'Weather',
  prayer: 'Prayer',
  games: 'Games reminder',
  custom: 'Custom message',
};

export async function listSchedules(): Promise<Schedule[]> {
  const { data, error } = await client().from('scheduled_notifications').select('*').order('send_time');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    link: r.link,
    sendTime: r.send_time.slice(0, 5),
    repeat: r.repeat,
    startDate: r.start_date ?? '',
    endDate: r.end_date ?? '',
    validMinutes: r.valid_minutes,
    enabled: r.enabled,
  }));
}

export async function saveSchedule(input: ScheduleInput): Promise<void> {
  const row = {
    kind: input.kind,
    title: input.title.trim(),
    body: input.body.trim(),
    link: input.link.trim(),
    send_time: input.sendTime,
    repeat: input.repeat,
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    valid_minutes: input.validMinutes,
    enabled: input.enabled,
  };
  const query = input.id ? client().from('scheduled_notifications').update(row).eq('id', input.id) : client().from('scheduled_notifications').insert(row);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await client().from('scheduled_notifications').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getTimezone(): Promise<string> {
  const { data, error } = await client().from('app_settings').select('value').eq('key', 'notify_timezone').maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (data as { value: string }).value : 'Africa/Lagos';
}

export async function saveTimezone(zone: string): Promise<void> {
  const { error } = await client().from('app_settings').upsert({ key: 'notify_timezone', value: zone.trim() }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}
