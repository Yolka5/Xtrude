/**
 * GENERATED FILE - do not edit by hand.
 * Regenerate with:  npm run fixtures   (see scripts/gen-fixtures.mjs)
 *
 * Phase 0.5 is a visual shell. Every number below is a constant. Nothing here
 * is fetched, computed at runtime, or derived from the system clock - the app's
 * "today" is the TODAY constant, so the UI renders identically forever.
 *
 * The distribution is modelled on what phase0_validate.py measured against real
 * Onshape microversion history: short bursts, several a day, median around
 * 11 minutes of credited time.
 */

/** The scoring parameters this data was generated under, mirrored from phase0_validate.py. */
export const SCORING = {
  idleThresholdMinutes: 20,
  leadInMinutes: 5,
  maxSessionHours: 4,
  minEvents: 3,
} as const;

/** The app's fixed "now". Nothing reads Date.now(). */
export const TODAY = "2026-09-09";

export type TouchedDocument = {
  /** Onshape document name. */
  name: string;
  /** The tab (Part Studio / Assembly / Drawing) the edits landed in. */
  tab: string;
  /** Microversions attributed to this document within the session. */
  edits: number;
};

export type Session = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24-hour. First recorded event. */
  start: string;
  /** HH:MM, 24-hour. Last recorded event. */
  end: string;
  /** Observed span: last event minus first event. */
  rawMinutes: number;
  /** Credited time: raw + lead-in, capped at the max session length. */
  scoredMinutes: number;
  /** Credit for ramp-up before the first save. */
  leadInMinutes: number;
  /** Microversions in the cluster. */
  eventCount: number;
  /** True when geometry actually changed, not just metadata. */
  verified: boolean;
  documents: TouchedDocument[];
};

export type DayTotal = { date: string; scoredMinutes: number; sessions: number };

export type WeekDay = {
  /** Short weekday name, Monday-anchored. */
  label: string;
  date: string;
  scoredMinutes: number;
  sessions: number;
  isToday: boolean;
  /** Later this week - rendered dimmed, not as a zero. */
  isFuture: boolean;
};

export type LeagueMember = {
  id: string;
  name: string;
  initials: string;
  scoredMinutes: number;
  sessions: number;
  /** Position at the end of last week, for the movement indicator. */
  lastRank: number;
  rank: number;
  /** lastRank - rank. Positive is a climb. */
  movement: number;
  isMe: boolean;
};

export type League = {
  name: string;
  memberCount: number;
  /** Days of the current week already counted, out of 7. */
  daysElapsed: number;
  members: LeagueMember[];
};

export type PersonalRecord = {
  label: string;
  value: number;
  unit: string;
  /** ISO date, or "" when the record is not tied to one day. */
  when: string;
};

export type Badge = {
  id: string;
  name: string;
  detail: string;
  glyph: string;
  earned: boolean;
  earnedOn: string | null;
};

/** Full session records for the last 21 days, newest first. */
export const SESSIONS: Session[] = [
  {
    "id": "s0276",
    "date": "2026-09-09",
    "start": "13:57",
    "end": "14:13",
    "rawMinutes": 16,
    "scoredMinutes": 21,
    "leadInMinutes": 5,
    "eventCount": 22,
    "verified": true,
    "documents": [
      {
        "name": "Bearing Block",
        "tab": "Assembly",
        "edits": 22
      }
    ]
  },
  {
    "id": "s0275",
    "date": "2026-09-09",
    "start": "11:03",
    "end": "11:04",
    "rawMinutes": 1,
    "scoredMinutes": 6,
    "leadInMinutes": 5,
    "eventCount": 3,
    "verified": true,
    "documents": [
      {
        "name": "Rover Chassis",
        "tab": "Skid Plate",
        "edits": 3
      }
    ]
  },
  {
    "id": "s0274",
    "date": "2026-09-08",
    "start": "12:21",
    "end": "12:24",
    "rawMinutes": 3,
    "scoredMinutes": 8,
    "leadInMinutes": 5,
    "eventCount": 6,
    "verified": true,
    "documents": [
      {
        "name": "Bearing Block",
        "tab": "Assembly",
        "edits": 6
      }
    ]
  },
  {
    "id": "s0273",
    "date": "2026-09-08",
    "start": "09:44",
    "end": "09:59",
    "rawMinutes": 15,
    "scoredMinutes": 20,
    "leadInMinutes": 5,
    "eventCount": 17,
    "verified": true,
    "documents": [
      {
        "name": "Bearing Block",
        "tab": "Assembly",
        "edits": 12
      },
      {
        "name": "Enclosure v4",
        "tab": "Lid",
        "edits": 5
      }
    ]
  },
  {
    "id": "s0272",
    "date": "2026-09-07",
    "start": "11:24",
    "end": "11:26",
    "rawMinutes": 2,
    "scoredMinutes": 7,
    "leadInMinutes": 5,
    "eventCount": 3,
    "verified": true,
    "documents": [
      {
        "name": "Bearing Block",
        "tab": "Cap",
        "edits": 3
      }
    ]
  },
  {
    "id": "s0271",
    "date": "2026-09-07",
    "start": "10:19",
    "end": "10:34",
    "rawMinutes": 15,
    "scoredMinutes": 20,
    "leadInMinutes": 5,
    "eventCount": 13,
    "verified": false,
    "documents": [
      {
        "name": "Camera Mount Rev B",
        "tab": "Assembly",
        "edits": 13
      }
    ]
  },
  {
    "id": "s0270",
    "date": "2026-09-06",
    "start": "13:43",
    "end": "13:52",
    "rawMinutes": 9,
    "scoredMinutes": 14,
    "leadInMinutes": 5,
    "eventCount": 8,
    "verified": true,
    "documents": [
      {
        "name": "Bearing Block",
        "tab": "Assembly",
        "edits": 8
      }
    ]
  },
  {
    "id": "s0269",
    "date": "2026-09-06",
    "start": "12:58",
    "end": "13:11",
    "rawMinutes": 13,
    "scoredMinutes": 18,
    "leadInMinutes": 5,
    "eventCount": 16,
    "verified": true,
    "documents": [
      {
        "name": "Bearing Block",
        "tab": "Assembly",
        "edits": 11
      },
      {
        "name": "Enclosure v4",
        "tab": "Shell",
        "edits": 5
      }
    ]
  },
  {
    "id": "s0268",
    "date": "2026-09-06",
    "start": "10:51",
    "end": "10:53",
    "rawMinutes": 2,
    "scoredMinutes": 7,
    "leadInMinutes": 5,
    "eventCount": 5,
    "verified": true,
    "documents": [
      {
        "name": "Rover Chassis",
        "tab": "Skid Plate",
        "edits": 5
      }
    ]
  },
  {
    "id": "s0267",
    "date": "2026-09-06",
    "start": "10:14",
    "end": "10:16",
    "rawMinutes": 2,
    "scoredMinutes": 7,
    "leadInMinutes": 5,
    "eventCount": 5,
    "verified": true,
    "documents": [
      {
        "name": "Rover Chassis",
        "tab": "Skid Plate",
        "edits": 5
      }
    ]
  },
  {
    "id": "s0266",
    "date": "2026-09-05",
    "start": "11:18",
    "end": "11:37",
    "rawMinutes": 19,
    "scoredMinutes": 24,
    "leadInMinutes": 5,
    "eventCount": 23,
    "verified": true,
    "documents": [
      {
        "name": "Camera Mount Rev B",
        "tab": "Ball Joint",
        "edits": 23
      }
    ]
  },
  {
    "id": "s0265",
    "date": "2026-09-05",
    "start": "09:22",
    "end": "09:26",
    "rawMinutes": 4,
    "scoredMinutes": 9,
    "leadInMinutes": 5,
    "eventCount": 6,
    "verified": true,
    "documents": [
      {
        "name": "Rover Chassis",
        "tab": "Frame",
        "edits": 6
      }
    ]
  },
  {
    "id": "s0264",
    "date": "2026-09-04",
    "start": "18:31",
    "end": "18:48",
    "rawMinutes": 17,
    "scoredMinutes": 22,
    "leadInMinutes": 5,
    "eventCount": 20,
    "verified": false,
    "documents": [
      {
        "name": "M5 Standoff Kit",
        "tab": "Standoff",
        "edits": 20
      }
    ]
  },
  {
    "id": "s0263",
    "date": "2026-09-04",
    "start": "15:36",
    "end": "15:51",
    "rawMinutes": 15,
    "scoredMinutes": 20,
    "leadInMinutes": 5,
    "eventCount": 21,
    "verified": true,
    "documents": [
      {
        "name": "Camera Mount Rev B",
        "tab": "Ball Joint",
        "edits": 21
      }
    ]
  },
  {
    "id": "s0262",
    "date": "2026-09-04",
    "start": "13:27",
    "end": "13:28",
    "rawMinutes": 1,
    "scoredMinutes": 6,
    "leadInMinutes": 5,
    "eventCount": 3,
    "verified": true,
    "documents": [
      {
        "name": "Drivetrain Gearbox",
        "tab": "Gear Train",
        "edits": 3
      }
    ]
  },
  {
    "id": "s0261",
    "date": "2026-09-04",
    "start": "12:27",
    "end": "12:32",
    "rawMinutes": 5,
    "scoredMinutes": 10,
    "leadInMinutes": 5,
    "eventCount": 9,
    "verified": true,
    "documents": [
      {
        "name": "M5 Standoff Kit",
        "tab": "Standoff",
        "edits": 9
      }
    ]
  },
  {
    "id": "s0260",
    "date": "2026-09-03",
    "start": "11:18",
    "end": "11:25",
    "rawMinutes": 7,
    "scoredMinutes": 12,
    "leadInMinutes": 5,
    "eventCount": 10,
    "verified": true,
    "documents": [
      {
        "name": "M5 Standoff Kit",
        "tab": "Drawing",
        "edits": 10
      }
    ]
  },
  {
    "id": "s0259",
    "date": "2026-09-03",
    "start": "10:11",
    "end": "10:14",
    "rawMinutes": 3,
    "scoredMinutes": 8,
    "leadInMinutes": 5,
    "eventCount": 6,
    "verified": true,
    "documents": [
      {
        "name": "Camera Mount Rev B",
        "tab": "Ball Joint",
        "edits": 6
      }
    ]
  },
  {
    "id": "s0258",
    "date": "2026-09-02",
    "start": "12:02",
    "end": "12:03",
    "rawMinutes": 1,
    "scoredMinutes": 6,
    "leadInMinutes": 5,
    "eventCount": 3,
    "verified": true,
    "documents": [
      {
        "name": "Bearing Block",
        "tab": "Cap",
        "edits": 3
      }
    ]
  },
  {
    "id": "s0257",
    "date": "2026-09-02",
    "start": "11:22",
    "end": "11:24",
    "rawMinutes": 2,
    "scoredMinutes": 7,
    "leadInMinutes": 5,
    "eventCount": 3,
    "verified": true,
    "documents": [
      {
        "name": "Enclosure v4",
        "tab": "Shell",
        "edits": 2
      },
      {
        "name": "Bearing Block",
        "tab": "Cap",
        "edits": 1
      }
    ]
  },
  {
    "id": "s0256",
    "date": "2026-09-01",
    "start": "10:36",
    "end": "10:38",
    "rawMinutes": 2,
    "scoredMinutes": 7,
    "leadInMinutes": 5,
    "eventCount": 4,
    "verified": true,
    "documents": [
      {
        "name": "Rover Chassis",
        "tab": "Frame",
        "edits": 4
      }
    ]
  },
  {
    "id": "s0255",
    "date": "2026-08-31",
    "start": "18:34",
    "end": "18:35",
    "rawMinutes": 1,
    "scoredMinutes": 6,
    "leadInMinutes": 5,
    "eventCount": 3,
    "verified": true,
    "documents": [
      {
        "name": "Bearing Block",
        "tab": "Cap",
        "edits": 3
      }
    ]
  },
  {
    "id": "s0254",
    "date": "2026-08-31",
    "start": "17:01",
    "end": "17:19",
    "rawMinutes": 18,
    "scoredMinutes": 23,
    "leadInMinutes": 5,
    "eventCount": 21,
    "verified": true,
    "documents": [
      {
        "name": "Bearing Block",
        "tab": "Assembly",
        "edits": 21
      }
    ]
  },
  {
    "id": "s0253",
    "date": "2026-08-31",
    "start": "13:38",
    "end": "13:54",
    "rawMinutes": 16,
    "scoredMinutes": 21,
    "leadInMinutes": 5,
    "eventCount": 15,
    "verified": true,
    "documents": [
      {
        "name": "Enclosure v4",
        "tab": "Shell",
        "edits": 15
      }
    ]
  },
  {
    "id": "s0252",
    "date": "2026-08-31",
    "start": "12:53",
    "end": "13:04",
    "rawMinutes": 11,
    "scoredMinutes": 16,
    "leadInMinutes": 5,
    "eventCount": 12,
    "verified": true,
    "documents": [
      {
        "name": "Camera Mount Rev B",
        "tab": "Assembly",
        "edits": 12
      }
    ]
  },
  {
    "id": "s0251",
    "date": "2026-08-30",
    "start": "12:36",
    "end": "12:44",
    "rawMinutes": 8,
    "scoredMinutes": 13,
    "leadInMinutes": 5,
    "eventCount": 12,
    "verified": true,
    "documents": [
      {
        "name": "Camera Mount Rev B",
        "tab": "Bracket",
        "edits": 12
      }
    ]
  },
  {
    "id": "s0250",
    "date": "2026-08-30",
    "start": "11:40",
    "end": "11:58",
    "rawMinutes": 18,
    "scoredMinutes": 23,
    "leadInMinutes": 5,
    "eventCount": 18,
    "verified": false,
    "documents": [
      {
        "name": "Drivetrain Gearbox",
        "tab": "Output Shaft",
        "edits": 18
      }
    ]
  },
  {
    "id": "s0249",
    "date": "2026-08-30",
    "start": "09:02",
    "end": "09:03",
    "rawMinutes": 1,
    "scoredMinutes": 6,
    "leadInMinutes": 5,
    "eventCount": 3,
    "verified": true,
    "documents": [
      {
        "name": "Drivetrain Gearbox",
        "tab": "Output Shaft",
        "edits": 3
      }
    ]
  },
  {
    "id": "s0248",
    "date": "2026-08-29",
    "start": "17:10",
    "end": "17:11",
    "rawMinutes": 1,
    "scoredMinutes": 6,
    "leadInMinutes": 5,
    "eventCount": 3,
    "verified": true,
    "documents": [
      {
        "name": "M5 Standoff Kit",
        "tab": "Drawing",
        "edits": 3
      }
    ]
  },
  {
    "id": "s0247",
    "date": "2026-08-29",
    "start": "14:24",
    "end": "14:31",
    "rawMinutes": 7,
    "scoredMinutes": 12,
    "leadInMinutes": 5,
    "eventCount": 11,
    "verified": false,
    "documents": [
      {
        "name": "Enclosure v4",
        "tab": "Gasket Groove",
        "edits": 11
      }
    ]
  },
  {
    "id": "s0246",
    "date": "2026-08-29",
    "start": "11:23",
    "end": "11:26",
    "rawMinutes": 3,
    "scoredMinutes": 8,
    "leadInMinutes": 5,
    "eventCount": 4,
    "verified": true,
    "documents": [
      {
        "name": "Bearing Block",
        "tab": "Cap",
        "edits": 4
      }
    ]
  },
  {
    "id": "s0245",
    "date": "2026-08-28",
    "start": "15:19",
    "end": "15:36",
    "rawMinutes": 17,
    "scoredMinutes": 22,
    "leadInMinutes": 5,
    "eventCount": 18,
    "verified": true,
    "documents": [
      {
        "name": "Drivetrain Gearbox",
        "tab": "Gear Train",
        "edits": 18
      }
    ]
  },
  {
    "id": "s0244",
    "date": "2026-08-28",
    "start": "13:21",
    "end": "13:39",
    "rawMinutes": 18,
    "scoredMinutes": 23,
    "leadInMinutes": 5,
    "eventCount": 21,
    "verified": true,
    "documents": [
      {
        "name": "Rover Chassis",
        "tab": "Suspension Mount",
        "edits": 21
      }
    ]
  },
  {
    "id": "s0243",
    "date": "2026-08-28",
    "start": "10:41",
    "end": "10:47",
    "rawMinutes": 6,
    "scoredMinutes": 11,
    "leadInMinutes": 5,
    "eventCount": 8,
    "verified": true,
    "documents": [
      {
        "name": "Camera Mount Rev B",
        "tab": "Bracket",
        "edits": 8
      }
    ]
  },
  {
    "id": "s0242",
    "date": "2026-08-27",
    "start": "14:06",
    "end": "14:25",
    "rawMinutes": 19,
    "scoredMinutes": 24,
    "leadInMinutes": 5,
    "eventCount": 18,
    "verified": true,
    "documents": [
      {
        "name": "Bearing Block",
        "tab": "Block",
        "edits": 18
      }
    ]
  },
  {
    "id": "s0241",
    "date": "2026-08-27",
    "start": "10:53",
    "end": "11:09",
    "rawMinutes": 16,
    "scoredMinutes": 21,
    "leadInMinutes": 5,
    "eventCount": 20,
    "verified": false,
    "documents": [
      {
        "name": "Rover Chassis",
        "tab": "Skid Plate",
        "edits": 20
      }
    ]
  },
  {
    "id": "s0240",
    "date": "2026-08-26",
    "start": "09:23",
    "end": "09:25",
    "rawMinutes": 2,
    "scoredMinutes": 7,
    "leadInMinutes": 5,
    "eventCount": 5,
    "verified": true,
    "documents": [
      {
        "name": "Drivetrain Gearbox",
        "tab": "Output Shaft",
        "edits": 5
      }
    ]
  },
  {
    "id": "s0239",
    "date": "2026-08-24",
    "start": "12:37",
    "end": "12:45",
    "rawMinutes": 8,
    "scoredMinutes": 13,
    "leadInMinutes": 5,
    "eventCount": 11,
    "verified": false,
    "documents": [
      {
        "name": "M5 Standoff Kit",
        "tab": "Standoff",
        "edits": 11
      }
    ]
  },
  {
    "id": "s0238",
    "date": "2026-08-24",
    "start": "10:33",
    "end": "10:39",
    "rawMinutes": 6,
    "scoredMinutes": 11,
    "leadInMinutes": 5,
    "eventCount": 6,
    "verified": true,
    "documents": [
      {
        "name": "Camera Mount Rev B",
        "tab": "Ball Joint",
        "edits": 4
      },
      {
        "name": "M5 Standoff Kit",
        "tab": "Drawing",
        "edits": 2
      }
    ]
  },
  {
    "id": "s0237",
    "date": "2026-08-23",
    "start": "09:50",
    "end": "09:51",
    "rawMinutes": 1,
    "scoredMinutes": 6,
    "leadInMinutes": 5,
    "eventCount": 3,
    "verified": true,
    "documents": [
      {
        "name": "M5 Standoff Kit",
        "tab": "Standoff",
        "edits": 3
      }
    ]
  },
  {
    "id": "s0236",
    "date": "2026-08-22",
    "start": "18:25",
    "end": "18:41",
    "rawMinutes": 16,
    "scoredMinutes": 21,
    "leadInMinutes": 5,
    "eventCount": 21,
    "verified": false,
    "documents": [
      {
        "name": "Drivetrain Gearbox",
        "tab": "Gear Train",
        "edits": 21
      }
    ]
  },
  {
    "id": "s0235",
    "date": "2026-08-22",
    "start": "15:42",
    "end": "15:53",
    "rawMinutes": 11,
    "scoredMinutes": 16,
    "leadInMinutes": 5,
    "eventCount": 12,
    "verified": true,
    "documents": [
      {
        "name": "Rover Chassis",
        "tab": "Suspension Mount",
        "edits": 8
      },
      {
        "name": "M5 Standoff Kit",
        "tab": "Standoff",
        "edits": 4
      }
    ]
  },
  {
    "id": "s0234",
    "date": "2026-08-22",
    "start": "13:00",
    "end": "13:01",
    "rawMinutes": 1,
    "scoredMinutes": 6,
    "leadInMinutes": 5,
    "eventCount": 3,
    "verified": true,
    "documents": [
      {
        "name": "Bearing Block",
        "tab": "Block",
        "edits": 3
      }
    ]
  },
  {
    "id": "s0233",
    "date": "2026-08-22",
    "start": "10:04",
    "end": "10:16",
    "rawMinutes": 12,
    "scoredMinutes": 17,
    "leadInMinutes": 5,
    "eventCount": 14,
    "verified": true,
    "documents": [
      {
        "name": "Bearing Block",
        "tab": "Cap",
        "edits": 14
      }
    ]
  },
  {
    "id": "s0232",
    "date": "2026-08-21",
    "start": "14:39",
    "end": "14:44",
    "rawMinutes": 5,
    "scoredMinutes": 10,
    "leadInMinutes": 5,
    "eventCount": 5,
    "verified": true,
    "documents": [
      {
        "name": "Enclosure v4",
        "tab": "Gasket Groove",
        "edits": 5
      }
    ]
  },
  {
    "id": "s0231",
    "date": "2026-08-21",
    "start": "13:34",
    "end": "13:36",
    "rawMinutes": 2,
    "scoredMinutes": 7,
    "leadInMinutes": 5,
    "eventCount": 3,
    "verified": true,
    "documents": [
      {
        "name": "Enclosure v4",
        "tab": "Shell",
        "edits": 3
      }
    ]
  },
  {
    "id": "s0230",
    "date": "2026-08-21",
    "start": "11:42",
    "end": "11:51",
    "rawMinutes": 9,
    "scoredMinutes": 14,
    "leadInMinutes": 5,
    "eventCount": 15,
    "verified": true,
    "documents": [
      {
        "name": "M5 Standoff Kit",
        "tab": "Standoff",
        "edits": 15
      }
    ]
  }
];

/** Daily totals across the whole 182-day window, oldest first. Drives the activity chart. */
export const DAILY: DayTotal[] = [
  {
    "date": "2026-03-12",
    "scoredMinutes": 40,
    "sessions": 2
  },
  {
    "date": "2026-03-13",
    "scoredMinutes": 23,
    "sessions": 2
  },
  {
    "date": "2026-03-14",
    "scoredMinutes": 19,
    "sessions": 2
  },
  {
    "date": "2026-03-15",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-03-16",
    "scoredMinutes": 54,
    "sessions": 4
  },
  {
    "date": "2026-03-17",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-03-18",
    "scoredMinutes": 32,
    "sessions": 3
  },
  {
    "date": "2026-03-19",
    "scoredMinutes": 33,
    "sessions": 4
  },
  {
    "date": "2026-03-20",
    "scoredMinutes": 25,
    "sessions": 2
  },
  {
    "date": "2026-03-21",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-03-22",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-03-23",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-03-24",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-03-25",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-03-26",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-03-27",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-03-28",
    "scoredMinutes": 14,
    "sessions": 1
  },
  {
    "date": "2026-03-29",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-03-30",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-03-31",
    "scoredMinutes": 17,
    "sessions": 2
  },
  {
    "date": "2026-04-01",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-04-02",
    "scoredMinutes": 18,
    "sessions": 2
  },
  {
    "date": "2026-04-03",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-04-04",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-04-05",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-04-06",
    "scoredMinutes": 59,
    "sessions": 4
  },
  {
    "date": "2026-04-07",
    "scoredMinutes": 31,
    "sessions": 3
  },
  {
    "date": "2026-04-08",
    "scoredMinutes": 38,
    "sessions": 3
  },
  {
    "date": "2026-04-09",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-04-10",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-04-11",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-04-12",
    "scoredMinutes": 38,
    "sessions": 3
  },
  {
    "date": "2026-04-13",
    "scoredMinutes": 42,
    "sessions": 3
  },
  {
    "date": "2026-04-14",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-04-15",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-04-16",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-04-17",
    "scoredMinutes": 12,
    "sessions": 2
  },
  {
    "date": "2026-04-18",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-04-19",
    "scoredMinutes": 12,
    "sessions": 2
  },
  {
    "date": "2026-04-20",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-04-21",
    "scoredMinutes": 41,
    "sessions": 4
  },
  {
    "date": "2026-04-22",
    "scoredMinutes": 31,
    "sessions": 2
  },
  {
    "date": "2026-04-23",
    "scoredMinutes": 48,
    "sessions": 4
  },
  {
    "date": "2026-04-24",
    "scoredMinutes": 54,
    "sessions": 4
  },
  {
    "date": "2026-04-25",
    "scoredMinutes": 45,
    "sessions": 2
  },
  {
    "date": "2026-04-26",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-04-27",
    "scoredMinutes": 6,
    "sessions": 1
  },
  {
    "date": "2026-04-28",
    "scoredMinutes": 14,
    "sessions": 1
  },
  {
    "date": "2026-04-29",
    "scoredMinutes": 21,
    "sessions": 1
  },
  {
    "date": "2026-04-30",
    "scoredMinutes": 28,
    "sessions": 3
  },
  {
    "date": "2026-05-01",
    "scoredMinutes": 42,
    "sessions": 4
  },
  {
    "date": "2026-05-02",
    "scoredMinutes": 30,
    "sessions": 2
  },
  {
    "date": "2026-05-03",
    "scoredMinutes": 19,
    "sessions": 1
  },
  {
    "date": "2026-05-04",
    "scoredMinutes": 20,
    "sessions": 1
  },
  {
    "date": "2026-05-05",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-05-06",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-05-07",
    "scoredMinutes": 16,
    "sessions": 2
  },
  {
    "date": "2026-05-08",
    "scoredMinutes": 22,
    "sessions": 1
  },
  {
    "date": "2026-05-09",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-05-10",
    "scoredMinutes": 22,
    "sessions": 1
  },
  {
    "date": "2026-05-11",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-05-12",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-05-13",
    "scoredMinutes": 18,
    "sessions": 2
  },
  {
    "date": "2026-05-14",
    "scoredMinutes": 12,
    "sessions": 1
  },
  {
    "date": "2026-05-15",
    "scoredMinutes": 37,
    "sessions": 4
  },
  {
    "date": "2026-05-16",
    "scoredMinutes": 12,
    "sessions": 1
  },
  {
    "date": "2026-05-17",
    "scoredMinutes": 6,
    "sessions": 1
  },
  {
    "date": "2026-05-18",
    "scoredMinutes": 29,
    "sessions": 2
  },
  {
    "date": "2026-05-19",
    "scoredMinutes": 18,
    "sessions": 2
  },
  {
    "date": "2026-05-20",
    "scoredMinutes": 31,
    "sessions": 2
  },
  {
    "date": "2026-05-21",
    "scoredMinutes": 28,
    "sessions": 3
  },
  {
    "date": "2026-05-22",
    "scoredMinutes": 27,
    "sessions": 2
  },
  {
    "date": "2026-05-23",
    "scoredMinutes": 35,
    "sessions": 2
  },
  {
    "date": "2026-05-24",
    "scoredMinutes": 19,
    "sessions": 2
  },
  {
    "date": "2026-05-25",
    "scoredMinutes": 44,
    "sessions": 3
  },
  {
    "date": "2026-05-26",
    "scoredMinutes": 42,
    "sessions": 2
  },
  {
    "date": "2026-05-27",
    "scoredMinutes": 20,
    "sessions": 2
  },
  {
    "date": "2026-05-28",
    "scoredMinutes": 6,
    "sessions": 1
  },
  {
    "date": "2026-05-29",
    "scoredMinutes": 44,
    "sessions": 4
  },
  {
    "date": "2026-05-30",
    "scoredMinutes": 24,
    "sessions": 2
  },
  {
    "date": "2026-05-31",
    "scoredMinutes": 33,
    "sessions": 3
  },
  {
    "date": "2026-06-01",
    "scoredMinutes": 20,
    "sessions": 2
  },
  {
    "date": "2026-06-02",
    "scoredMinutes": 39,
    "sessions": 3
  },
  {
    "date": "2026-06-03",
    "scoredMinutes": 21,
    "sessions": 2
  },
  {
    "date": "2026-06-04",
    "scoredMinutes": 17,
    "sessions": 2
  },
  {
    "date": "2026-06-05",
    "scoredMinutes": 10,
    "sessions": 1
  },
  {
    "date": "2026-06-06",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-06-07",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-06-08",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-06-09",
    "scoredMinutes": 6,
    "sessions": 1
  },
  {
    "date": "2026-06-10",
    "scoredMinutes": 16,
    "sessions": 1
  },
  {
    "date": "2026-06-11",
    "scoredMinutes": 30,
    "sessions": 3
  },
  {
    "date": "2026-06-12",
    "scoredMinutes": 38,
    "sessions": 4
  },
  {
    "date": "2026-06-13",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-06-14",
    "scoredMinutes": 27,
    "sessions": 2
  },
  {
    "date": "2026-06-15",
    "scoredMinutes": 48,
    "sessions": 3
  },
  {
    "date": "2026-06-16",
    "scoredMinutes": 43,
    "sessions": 2
  },
  {
    "date": "2026-06-17",
    "scoredMinutes": 44,
    "sessions": 3
  },
  {
    "date": "2026-06-18",
    "scoredMinutes": 38,
    "sessions": 3
  },
  {
    "date": "2026-06-19",
    "scoredMinutes": 22,
    "sessions": 3
  },
  {
    "date": "2026-06-20",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-06-21",
    "scoredMinutes": 22,
    "sessions": 2
  },
  {
    "date": "2026-06-22",
    "scoredMinutes": 6,
    "sessions": 1
  },
  {
    "date": "2026-06-23",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-06-24",
    "scoredMinutes": 14,
    "sessions": 2
  },
  {
    "date": "2026-06-25",
    "scoredMinutes": 17,
    "sessions": 1
  },
  {
    "date": "2026-06-26",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-06-27",
    "scoredMinutes": 24,
    "sessions": 3
  },
  {
    "date": "2026-06-28",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-06-29",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-06-30",
    "scoredMinutes": 6,
    "sessions": 1
  },
  {
    "date": "2026-07-01",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-07-02",
    "scoredMinutes": 32,
    "sessions": 2
  },
  {
    "date": "2026-07-03",
    "scoredMinutes": 26,
    "sessions": 2
  },
  {
    "date": "2026-07-04",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-07-05",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-07-06",
    "scoredMinutes": 59,
    "sessions": 4
  },
  {
    "date": "2026-07-07",
    "scoredMinutes": 27,
    "sessions": 2
  },
  {
    "date": "2026-07-08",
    "scoredMinutes": 35,
    "sessions": 3
  },
  {
    "date": "2026-07-09",
    "scoredMinutes": 54,
    "sessions": 4
  },
  {
    "date": "2026-07-10",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-07-11",
    "scoredMinutes": 32,
    "sessions": 2
  },
  {
    "date": "2026-07-12",
    "scoredMinutes": 23,
    "sessions": 2
  },
  {
    "date": "2026-07-13",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-07-14",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-07-15",
    "scoredMinutes": 34,
    "sessions": 2
  },
  {
    "date": "2026-07-16",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-07-17",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-07-18",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-07-19",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-07-20",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-07-21",
    "scoredMinutes": 18,
    "sessions": 2
  },
  {
    "date": "2026-07-22",
    "scoredMinutes": 26,
    "sessions": 2
  },
  {
    "date": "2026-07-23",
    "scoredMinutes": 54,
    "sessions": 3
  },
  {
    "date": "2026-07-24",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-07-25",
    "scoredMinutes": 17,
    "sessions": 2
  },
  {
    "date": "2026-07-26",
    "scoredMinutes": 18,
    "sessions": 2
  },
  {
    "date": "2026-07-27",
    "scoredMinutes": 42,
    "sessions": 3
  },
  {
    "date": "2026-07-28",
    "scoredMinutes": 12,
    "sessions": 1
  },
  {
    "date": "2026-07-29",
    "scoredMinutes": 7,
    "sessions": 1
  },
  {
    "date": "2026-07-30",
    "scoredMinutes": 36,
    "sessions": 2
  },
  {
    "date": "2026-07-31",
    "scoredMinutes": 16,
    "sessions": 2
  },
  {
    "date": "2026-08-01",
    "scoredMinutes": 29,
    "sessions": 2
  },
  {
    "date": "2026-08-02",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-08-03",
    "scoredMinutes": 22,
    "sessions": 2
  },
  {
    "date": "2026-08-04",
    "scoredMinutes": 36,
    "sessions": 2
  },
  {
    "date": "2026-08-05",
    "scoredMinutes": 19,
    "sessions": 1
  },
  {
    "date": "2026-08-06",
    "scoredMinutes": 39,
    "sessions": 4
  },
  {
    "date": "2026-08-07",
    "scoredMinutes": 37,
    "sessions": 3
  },
  {
    "date": "2026-08-08",
    "scoredMinutes": 42,
    "sessions": 3
  },
  {
    "date": "2026-08-09",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-08-10",
    "scoredMinutes": 6,
    "sessions": 1
  },
  {
    "date": "2026-08-11",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-08-12",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-08-13",
    "scoredMinutes": 9,
    "sessions": 1
  },
  {
    "date": "2026-08-14",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-08-15",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-08-16",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-08-17",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-08-18",
    "scoredMinutes": 27,
    "sessions": 3
  },
  {
    "date": "2026-08-19",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-08-20",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-08-21",
    "scoredMinutes": 31,
    "sessions": 3
  },
  {
    "date": "2026-08-22",
    "scoredMinutes": 60,
    "sessions": 4
  },
  {
    "date": "2026-08-23",
    "scoredMinutes": 6,
    "sessions": 1
  },
  {
    "date": "2026-08-24",
    "scoredMinutes": 24,
    "sessions": 2
  },
  {
    "date": "2026-08-25",
    "scoredMinutes": 0,
    "sessions": 0
  },
  {
    "date": "2026-08-26",
    "scoredMinutes": 7,
    "sessions": 1
  },
  {
    "date": "2026-08-27",
    "scoredMinutes": 45,
    "sessions": 2
  },
  {
    "date": "2026-08-28",
    "scoredMinutes": 56,
    "sessions": 3
  },
  {
    "date": "2026-08-29",
    "scoredMinutes": 26,
    "sessions": 3
  },
  {
    "date": "2026-08-30",
    "scoredMinutes": 42,
    "sessions": 3
  },
  {
    "date": "2026-08-31",
    "scoredMinutes": 66,
    "sessions": 4
  },
  {
    "date": "2026-09-01",
    "scoredMinutes": 7,
    "sessions": 1
  },
  {
    "date": "2026-09-02",
    "scoredMinutes": 13,
    "sessions": 2
  },
  {
    "date": "2026-09-03",
    "scoredMinutes": 20,
    "sessions": 2
  },
  {
    "date": "2026-09-04",
    "scoredMinutes": 58,
    "sessions": 4
  },
  {
    "date": "2026-09-05",
    "scoredMinutes": 33,
    "sessions": 2
  },
  {
    "date": "2026-09-06",
    "scoredMinutes": 46,
    "sessions": 4
  },
  {
    "date": "2026-09-07",
    "scoredMinutes": 27,
    "sessions": 2
  },
  {
    "date": "2026-09-08",
    "scoredMinutes": 28,
    "sessions": 2
  },
  {
    "date": "2026-09-09",
    "scoredMinutes": 27,
    "sessions": 2
  }
];

export const WEEK: WeekDay[] = [
  {
    "label": "Mon",
    "date": "2026-09-07",
    "scoredMinutes": 27,
    "sessions": 2,
    "isToday": false,
    "isFuture": false
  },
  {
    "label": "Tue",
    "date": "2026-09-08",
    "scoredMinutes": 28,
    "sessions": 2,
    "isToday": false,
    "isFuture": false
  },
  {
    "label": "Wed",
    "date": "2026-09-09",
    "scoredMinutes": 27,
    "sessions": 2,
    "isToday": true,
    "isFuture": false
  },
  {
    "label": "Thu",
    "date": "2026-09-10",
    "scoredMinutes": 0,
    "sessions": 0,
    "isToday": false,
    "isFuture": true
  },
  {
    "label": "Fri",
    "date": "2026-09-11",
    "scoredMinutes": 0,
    "sessions": 0,
    "isToday": false,
    "isFuture": true
  },
  {
    "label": "Sat",
    "date": "2026-09-12",
    "scoredMinutes": 0,
    "sessions": 0,
    "isToday": false,
    "isFuture": true
  },
  {
    "label": "Sun",
    "date": "2026-09-13",
    "scoredMinutes": 0,
    "sessions": 0,
    "isToday": false,
    "isFuture": true
  }
];

export const TODAY_STATS = {
  "scoredMinutes": 27,
  "sessions": 2,
  "events": 25
} as const;

export const STREAK = {
  "current": 15,
  "longest": 24,
  "weekMinutes": 82,
  "weekDaysElapsed": 3,
  "lastWeekMinutes": 243
} as const;

export const PROFILE = {
  "name": "You",
  "handle": "@yoni",
  "initials": "YS",
  "memberSince": "March 2026",
  "lifetimeMinutes": 3415,
  "lifetimeHours": 56.9,
  "totalSessions": 276,
  "activeDays": 121,
  "longestStreak": 24,
  "currentStreak": 15,
  "medianSessionMinutes": 11,
  "verifiedShare": 80
} as const;

export const RECORDS: PersonalRecord[] = [
  {
    "label": "Longest session",
    "value": 25,
    "unit": "min",
    "when": "2026-04-12"
  },
  {
    "label": "Best day",
    "value": 66,
    "unit": "min",
    "when": "2026-08-31"
  },
  {
    "label": "Best week",
    "value": 4.3,
    "unit": "hrs",
    "when": "2026-08-27"
  },
  {
    "label": "Most sessions in a day",
    "value": 4,
    "unit": "",
    "when": "2026-03-16"
  },
  {
    "label": "Most edits in a session",
    "value": 31,
    "unit": "",
    "when": "2026-04-12"
  },
  {
    "label": "Longest streak",
    "value": 24,
    "unit": "days",
    "when": ""
  }
];

export const LEAGUE: League = {
  "name": "Thursday Night CAD",
  "memberCount": 6,
  "daysElapsed": 3,
  "members": [
    {
      "id": "m1",
      "name": "Priya Raman",
      "initials": "PR",
      "scoredMinutes": 118,
      "sessions": 9,
      "lastRank": 2,
      "isMe": false,
      "rank": 1,
      "movement": 1
    },
    {
      "id": "m2",
      "name": "Tomas Weiss",
      "initials": "TW",
      "scoredMinutes": 96,
      "sessions": 8,
      "lastRank": 1,
      "isMe": false,
      "rank": 2,
      "movement": -1
    },
    {
      "id": "m3",
      "name": "You",
      "initials": "YS",
      "scoredMinutes": 82,
      "sessions": 6,
      "lastRank": 5,
      "isMe": true,
      "rank": 3,
      "movement": 2
    },
    {
      "id": "m4",
      "name": "Alex Nakamura",
      "initials": "AN",
      "scoredMinutes": 71,
      "sessions": 6,
      "lastRank": 3,
      "isMe": false,
      "rank": 4,
      "movement": -1
    },
    {
      "id": "m5",
      "name": "Dani Okafor",
      "initials": "DO",
      "scoredMinutes": 44,
      "sessions": 4,
      "lastRank": 4,
      "isMe": false,
      "rank": 5,
      "movement": -1
    },
    {
      "id": "m6",
      "name": "Sam Ellery",
      "initials": "SE",
      "scoredMinutes": 19,
      "sessions": 2,
      "lastRank": 6,
      "isMe": false,
      "rank": 6,
      "movement": 0
    }
  ]
};

export const BADGES: Badge[] = [
  {
    "id": "b1",
    "name": "First Extrude",
    "detail": "Log your first session",
    "glyph": "spark",
    "earned": true,
    "earnedOn": "2026-03-18"
  },
  {
    "id": "b2",
    "name": "Week One",
    "detail": "7-day streak",
    "glyph": "flame",
    "earned": true,
    "earnedOn": "2026-04-02"
  },
  {
    "id": "b3",
    "name": "Fortnight",
    "detail": "14-day streak",
    "glyph": "flame2",
    "earned": true,
    "earnedOn": "2026-06-11"
  },
  {
    "id": "b4",
    "name": "Deep Work",
    "detail": "One session over 20 minutes",
    "glyph": "clock",
    "earned": true,
    "earnedOn": "2026-05-27"
  },
  {
    "id": "b5",
    "name": "Verified 100",
    "detail": "100 geometry-verified sessions",
    "glyph": "check",
    "earned": true,
    "earnedOn": "2026-07-30"
  },
  {
    "id": "b6",
    "name": "Fifty Hours",
    "detail": "50 hours modeled",
    "glyph": "hourglass",
    "earned": true,
    "earnedOn": "2026-08-21"
  },
  {
    "id": "b7",
    "name": "Month Straight",
    "detail": "30-day streak",
    "glyph": "calendar",
    "earned": false,
    "earnedOn": null
  },
  {
    "id": "b8",
    "name": "Marathon",
    "detail": "One session over 2 hours",
    "glyph": "run",
    "earned": false,
    "earnedOn": null
  },
  {
    "id": "b9",
    "name": "League Winner",
    "detail": "Finish a week ranked first",
    "glyph": "trophy",
    "earned": false,
    "earnedOn": null
  },
  {
    "id": "b10",
    "name": "Polymath",
    "detail": "Touch 10 documents in a week",
    "glyph": "layers",
    "earned": false,
    "earnedOn": null
  },
  {
    "id": "b11",
    "name": "Dawn Patrol",
    "detail": "20 sessions before 8am",
    "glyph": "sunrise",
    "earned": false,
    "earnedOn": null
  },
  {
    "id": "b12",
    "name": "Century",
    "detail": "100 hours modeled",
    "glyph": "crown",
    "earned": false,
    "earnedOn": null
  }
];
