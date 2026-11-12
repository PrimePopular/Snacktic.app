/** The Find a Friend event that is on right now. */
export interface LiveFindFriend {
  id: string;
  name: string;
  pointsPerScan: number;
  endsAt: string;
  prizeFirst: number;
  prizeSecond: number;
  prizeThird: number;
}

export interface FoundFriend {
  name: string;
  foundAt: string;
}

export interface LeaderRow {
  place: number;
  name: string;
  found: number;
}

export interface ScanResult {
  points: number;
  name: string;
}

/** One row of the owner's overview: a past or current event with its numbers. */
export interface FindFriendOverview {
  id: string;
  name: string;
  active: boolean;
  live: boolean;
  startsAt: string;
  endsAt: string;
  pointsPerScan: number;
  prizeFirst: number;
  prizeSecond: number;
  prizeThird: number;
  prizesPaid: boolean;
  players: number;
  scans: number;
}

export interface StartEventInput {
  name: string;
  pointsPerScan: number;
  prizeFirst: number;
  prizeSecond: number;
  prizeThird: number;
  endsAt: string;
}
