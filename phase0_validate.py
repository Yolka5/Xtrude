#!/usr/bin/env python3
"""
Xtrude Phase 0 - validation only.

Question this script answers: does Onshape's microversion history contain
enough granular, timestamped events to reconstruct real working sessions?

It pulls documenthistory for one document, dumps every timestamp, shows the
distribution of gaps between consecutive events, and runs the session
clustering algorithm over them.

Nothing is written anywhere. Read-only. Under 10 API calls per run.
"""

import base64
import os
import statistics
import sys
from datetime import datetime, timedelta, timezone

try:
    import requests
except ImportError:
    sys.exit("Missing dependency. Run:  pip install requests python-dotenv")

try:
    from dotenv import load_dotenv
except ImportError:
    sys.exit("Missing dependency. Run:  pip install requests python-dotenv")


# ---------------------------------------------------------------------------
# TUNABLE CONSTANTS - change these and rerun
# ---------------------------------------------------------------------------

IDLE_THRESHOLD_MINUTES = 20     # gap larger than this ends a session
LEAD_IN_MINUTES = 5             # credited before the first event of a session
MAX_SESSION_HOURS = 4           # hard cap on one session
MIN_EVENTS = 3                  # fewer events than this is noise, not a session

# Your local UTC offset, in hours, used only for display.
# Onshape returns UTC. Set this so the session times read the way you
# remember them (e.g. 3 for UTC+3, -5 for UTC-5). 0 = show raw UTC.
DISPLAY_TZ_OFFSET_HOURS = 0


# ---------------------------------------------------------------------------
# TARGET
# ---------------------------------------------------------------------------

BASE_URL = "https://cad.onshape.com/api"
DOCUMENT_ID = "6456cbab1ff00ddf0ea56943"
WORKSPACE_ID = "630287a3d72f30ecc8b82704"

PAGE_SIZE = 100     # microversions requested per call
MAX_PAGES = 8       # hard stop, keeps the run under 10 API calls total


# ---------------------------------------------------------------------------
# derived
# ---------------------------------------------------------------------------

IDLE_THRESHOLD_SECONDS = IDLE_THRESHOLD_MINUTES * 60
LEAD_IN_SECONDS = LEAD_IN_MINUTES * 60
MAX_SESSION_SECONDS = MAX_SESSION_HOURS * 3600
DISPLAY_TZ = timezone(timedelta(hours=DISPLAY_TZ_OFFSET_HOURS))

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(SCRIPT_DIR, ".env")

api_calls_made = 0


# ---------------------------------------------------------------------------
# auth + http
# ---------------------------------------------------------------------------

def load_credentials():
    """Read keys from .env (or the environment). Never printed, never logged."""
    load_dotenv(ENV_PATH)
    access = (os.environ.get("ONSHAPE_ACCESS_KEY") or "").strip()
    secret = (os.environ.get("ONSHAPE_SECRET_KEY") or "").strip()

    if not access or not secret:
        print("ONSHAPE_ACCESS_KEY / ONSHAPE_SECRET_KEY are not set.")
        print()
        if os.path.exists(ENV_PATH):
            print(f"Fill them in here: {ENV_PATH}")
        else:
            print(f"Create {ENV_PATH} containing:")
            print("  ONSHAPE_ACCESS_KEY=...")
            print("  ONSHAPE_SECRET_KEY=...")
        print()
        print("Keys come from https://dev-portal.onshape.com/keys")
        print("(.env is gitignored, so it will not be committed.)")
        sys.exit(1)

    token = base64.b64encode(f"{access}:{secret}".encode()).decode()
    return {
        "Authorization": f"Basic {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def api_get(path, headers, params=None):
    """GET with visible failures. Returns parsed JSON, or exits."""
    global api_calls_made
    url = f"{BASE_URL}{path}"
    api_calls_made += 1

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=30)
    except requests.RequestException as exc:
        print(f"\nREQUEST FAILED: {url}")
        print(f"  {type(exc).__name__}: {exc}")
        sys.exit(1)

    if resp.status_code >= 400:
        print(f"\nHTTP {resp.status_code} from {resp.url}")
        print("  response body:")
        body = resp.text or "(empty)"
        print("  " + body[:2000].replace("\n", "\n  "))
        if resp.status_code in (401, 403):
            print("\n  401/403 usually means bad keys, or keys without the")
            print("  scopes this call needs (read scope on documents).")
        print("\n  (4xx/5xx do not count against the annual API quota.)")
        sys.exit(1)

    try:
        return resp.json()
    except ValueError:
        print(f"\nResponse from {resp.url} was not JSON:")
        print("  " + (resp.text or "(empty)")[:2000])
        sys.exit(1)


# ---------------------------------------------------------------------------
# fetching
# ---------------------------------------------------------------------------

def parse_timestamp(raw):
    """Onshape returns e.g. 2024-03-11T18:32:14.000+0000. Return aware UTC."""
    if not raw:
        return None
    text = str(raw).strip()
    candidates = [text]
    if text.endswith("Z"):
        candidates.append(text[:-1] + "+00:00")
    # turn +0000 into +00:00 for older/pickier parsers
    if len(text) >= 5 and (text[-5] in "+-") and ":" not in text[-5:]:
        candidates.append(text[:-5] + text[-5:-2] + ":" + text[-2:])

    for candidate in candidates:
        try:
            parsed = datetime.fromisoformat(candidate)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except ValueError:
            pass

    for fmt in ("%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z",
                "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
        try:
            parsed = datetime.strptime(text, fmt)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except ValueError:
            pass

    print(f"  WARNING: could not parse timestamp {raw!r}")
    return None


def extract_rows(payload):
    """documenthistory may return a bare list or an object wrapping one."""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("items", "history", "microversions", "value"):
            if isinstance(payload.get(key), list):
                return payload[key]
    return []


def fetch_history(headers):
    """Page through documenthistory. Returns events sorted oldest first."""
    path = f"/v6/documents/d/{DOCUMENT_ID}/w/{WORKSPACE_ID}/documenthistory"
    seen_ids = set()
    events = []
    truncated = False

    for page in range(MAX_PAGES):
        offset = page * PAGE_SIZE
        payload = api_get(path, headers, params={"offset": offset,
                                                 "limit": PAGE_SIZE})
        rows = extract_rows(payload)
        print(f"  page {page + 1}: offset={offset} -> {len(rows)} rows")

        if not rows:
            break

        new_on_page = 0
        for row in rows:
            if not isinstance(row, dict):
                continue
            mv_id = (row.get("microversionId") or row.get("id")
                     or row.get("microversion"))
            key = mv_id or f"{row.get('date')}|{row.get('userId')}"
            if key in seen_ids:
                continue
            seen_ids.add(key)

            ts = parse_timestamp(row.get("date") or row.get("createdAt")
                                 or row.get("time"))
            if ts is None:
                continue

            events.append({
                "ts": ts,
                "microversion_id": mv_id,
                "user": row.get("userName") or row.get("user") or "?",
                "user_id": row.get("userId"),
                "description": row.get("description") or "",
            })
            new_on_page += 1

        if new_on_page == 0:
            print("  page returned nothing new - endpoint ignores offset, "
                  "stopping.")
            break
        if len(rows) < PAGE_SIZE:
            break
        if page == MAX_PAGES - 1:
            truncated = True

    events.sort(key=lambda e: e["ts"])
    return events, truncated


# ---------------------------------------------------------------------------
# formatting helpers
# ---------------------------------------------------------------------------

def fmt_duration(seconds):
    seconds = int(round(seconds))
    hours, rem = divmod(seconds, 3600)
    minutes, secs = divmod(rem, 60)
    if hours:
        return f"{hours}h {minutes:02d}m"
    if minutes:
        return f"{minutes}m {secs:02d}s"
    return f"{secs}s"


def local(ts):
    return ts.astimezone(DISPLAY_TZ)


def rule(char="-", width=78):
    print(char * width)


def section(title):
    print()
    rule("=")
    print(title)
    rule("=")


# ---------------------------------------------------------------------------
# 2 + 3: counts and raw dump
# ---------------------------------------------------------------------------

def report_count(events, truncated):
    section(f"2. MICROVERSION COUNT: {len(events)}")

    suspicious = {20, 25, 50, 100, 200, 250, 500, 1000}
    if len(events) in suspicious:
        print(f"WARNING: exactly {len(events)} rows. That is a page-size shaped")
        print("number - the endpoint is probably paginated and we are NOT")
        print("seeing full history. Raise MAX_PAGES / check PAGE_SIZE.")
    if truncated:
        print(f"WARNING: hit the MAX_PAGES cap ({MAX_PAGES} pages, "
              f"{MAX_PAGES * PAGE_SIZE} rows).")
        print("History is truncated. Everything below covers only the most")
        print("recent slice of the document's life.")
    if not truncated and len(events) not in suspicious:
        print("Pagination ran until a short/empty page, so this is the full")
        print("history the API is willing to return for this workspace.")

    if events:
        first, last = local(events[0]["ts"]), local(events[-1]["ts"])
        span_days = (events[-1]["ts"] - events[0]["ts"]).total_seconds() / 86400
        print()
        print(f"Range : {first:%Y-%m-%d %H:%M}  ->  {last:%Y-%m-%d %H:%M}")
        print(f"Span  : {span_days:.1f} days")
        print(f"Rate  : {len(events) / max(span_days, 1):.1f} events/day "
              f"averaged over the whole span")

        by_user = {}
        for ev in events:
            by_user[ev["user"]] = by_user.get(ev["user"], 0) + 1
        if len(by_user) > 1:
            print()
            print("Multiple contributors in this document:")
            for name, count in sorted(by_user.items(), key=lambda x: -x[1]):
                print(f"  {count:5d}  {name}")
            print("(Relevant later: credit has to follow the per-event user.)")


def dump_timestamps(events):
    section("3. RAW TIMESTAMP DUMP")
    print(f"All times UTC{DISPLAY_TZ_OFFSET_HOURS:+d}. "
          "Gap = time since the previous event.")
    print()
    print(f"{'#':>5}  {'TIMESTAMP':<20} {'GAP':>10}  {'USER':<18} DESCRIPTION")
    rule()

    prev = None
    for i, ev in enumerate(events, 1):
        gap = "-" if prev is None else fmt_duration(
            (ev["ts"] - prev).total_seconds())
        desc = ev["description"][:32]
        print(f"{i:>5}  {local(ev['ts']):%Y-%m-%d %H:%M:%S}  {gap:>10}  "
              f"{ev['user'][:18]:<18} {desc}")
        prev = ev["ts"]


# ---------------------------------------------------------------------------
# 4: gap statistics
# ---------------------------------------------------------------------------

GAP_BUCKETS = [
    ("< 30s",        0,        30),
    ("30s - 1m",     30,       60),
    ("1m - 2m",      60,       120),
    ("2m - 5m",      120,      300),
    ("5m - 10m",     300,      600),
    ("10m - 20m",    600,      1200),
    ("20m - 30m",    1200,     1800),
    ("30m - 1h",     1800,     3600),
    ("1h - 2h",      3600,     7200),
    ("2h - 6h",      7200,     21600),
    ("6h - 24h",     21600,    86400),
    ("> 24h",        86400,    float("inf")),
]


def report_gaps(events):
    section("4. GAP STATISTICS")
    if len(events) < 2:
        print("Fewer than 2 events - no gaps to measure.")
        return

    gaps = [(events[i]["ts"] - events[i - 1]["ts"]).total_seconds()
            for i in range(1, len(events))]
    gaps_sorted = sorted(gaps)

    def pct(p):
        idx = min(int(p / 100 * len(gaps_sorted)), len(gaps_sorted) - 1)
        return gaps_sorted[idx]

    print(f"gaps measured : {len(gaps)}")
    print(f"min           : {fmt_duration(min(gaps))}")
    print(f"p25           : {fmt_duration(pct(25))}")
    print(f"median        : {fmt_duration(statistics.median(gaps))}")
    print(f"p75           : {fmt_duration(pct(75))}")
    print(f"p90           : {fmt_duration(pct(90))}")
    print(f"max           : {fmt_duration(max(gaps))}")
    print()

    counts = []
    for label, low, high in GAP_BUCKETS:
        counts.append(sum(1 for g in gaps if low <= g < high))
    peak = max(counts) or 1

    print("HISTOGRAM")
    for (label, _, _), count in zip(GAP_BUCKETS, counts):
        bar = "#" * int(round(40 * count / peak))
        share = 100 * count / len(gaps)
        print(f"  {label:<12} {count:5d} {share:5.1f}%  {bar}")

    below = sum(1 for g in gaps if g <= IDLE_THRESHOLD_SECONDS)
    print()
    print(f"{below} of {len(gaps)} gaps ({100 * below / len(gaps):.1f}%) are "
          f"<= the {IDLE_THRESHOLD_MINUTES}m idle threshold,")
    print("i.e. they get counted as continuous work. The rest split sessions.")
    print()
    print("Read this before trusting the sessions below: if the mass of the")
    print("histogram sits under ~10m, Onshape is recording granular edits and")
    print("the whole time-reconstruction model works. If it sits in hours,")
    print("Onshape is only checkpointing and the metric needs rethinking.")


# ---------------------------------------------------------------------------
# 5 + 6: clustering
# ---------------------------------------------------------------------------

def cluster_sessions(events):
    """Split into clusters on gaps > IDLE_THRESHOLD, then score each."""
    if not events:
        return []

    clusters = []
    current = [events[0]]
    for ev in events[1:]:
        gap = (ev["ts"] - current[-1]["ts"]).total_seconds()
        if gap > IDLE_THRESHOLD_SECONDS:
            clusters.append(current)
            current = [ev]
        else:
            current.append(ev)
    clusters.append(current)

    sessions = []
    for cluster in clusters:
        span = (cluster[-1]["ts"] - cluster[0]["ts"]).total_seconds()
        duration = min(span + LEAD_IN_SECONDS, MAX_SESSION_SECONDS)
        sessions.append({
            "start": cluster[0]["ts"],
            "end": cluster[-1]["ts"],
            "span_seconds": span,
            "duration_seconds": duration,
            "event_count": len(cluster),
            "clamped": span + LEAD_IN_SECONDS > MAX_SESSION_SECONDS,
            "kept": len(cluster) >= MIN_EVENTS,
            "users": sorted({ev["user"] for ev in cluster}),
        })
    return sessions


def report_sessions(sessions):
    section("6. RECONSTRUCTED SESSIONS")
    print(f"IDLE_THRESHOLD={IDLE_THRESHOLD_MINUTES}m  "
          f"LEAD_IN={LEAD_IN_MINUTES}m  "
          f"MAX_SESSION={MAX_SESSION_HOURS}h  "
          f"MIN_EVENTS={MIN_EVENTS}")
    print()

    kept = [s for s in sessions if s["kept"]]
    if not kept:
        print("No sessions survived MIN_EVENTS. Either the document is barely")
        print("used, or the clustering parameters are wrong for this data.")
        return kept

    print(f"{'DATE':<12} {'START':>8} {'END':>8} {'SPAN':>9} {'CREDITED':>9} "
          f"{'EVENTS':>7}  FLAGS")
    rule()
    for s in kept:
        start, end = local(s["start"]), local(s["end"])
        flags = []
        if end.date() != start.date():
            flags.append(f"ends {(end.date() - start.date()).days}d later")
        if s["clamped"]:
            flags.append(f"clamped to {MAX_SESSION_HOURS}h")
        if len(s["users"]) > 1:
            flags.append("+".join(s["users"]))
        print(f"{start:%Y-%m-%d} {start:%H:%M:%S} {end:%H:%M:%S} "
              f"{fmt_duration(s['span_seconds']):>9} "
              f"{fmt_duration(s['duration_seconds']):>9} "
              f"{s['event_count']:>7}  {', '.join(flags)}")

    dropped = [s for s in sessions if not s["kept"]]
    if dropped:
        dropped_events = sum(s["event_count"] for s in dropped)
        print()
        print(f"Discarded {len(dropped)} clusters with < {MIN_EVENTS} events "
              f"({dropped_events} events total).")
        print("These are single saves and quick touch-ups, not work sessions.")
    return kept


# ---------------------------------------------------------------------------
# 7: totals
# ---------------------------------------------------------------------------

def report_totals(events, sessions, kept):
    section("7. TOTALS")
    if not kept:
        print("Nothing to total.")
        return

    total_seconds = sum(s["duration_seconds"] for s in kept)
    total_hours = total_seconds / 3600
    span_days = max(
        (events[-1]["ts"] - events[0]["ts"]).total_seconds() / 86400, 1.0)
    weeks = max(span_days / 7, 1 / 7)
    active_days = len({local(s["start"]).date() for s in kept})

    durations = [s["duration_seconds"] for s in kept]
    counts = [s["event_count"] for s in kept]

    print(f"sessions kept       : {len(kept)}  "
          f"(of {len(sessions)} raw clusters)")
    print(f"events used         : {sum(counts)} of {len(events)}")
    print(f"total credited time : {total_hours:.1f} h")
    print(f"calendar span       : {span_days:.1f} days "
          f"({weeks:.1f} weeks)")
    print(f"hours per week      : {total_hours / weeks:.2f} h/week")
    print(f"active days         : {active_days} "
          f"({100 * active_days / span_days:.0f}% of days in span)")
    print(f"median session      : {fmt_duration(statistics.median(durations))}")
    print(f"longest session     : {fmt_duration(max(durations))}")
    print(f"median events/sess  : {statistics.median(counts):.0f}")
    clamped = sum(1 for s in kept if s["clamped"])
    if clamped:
        print(f"clamped at MAX      : {clamped} "
              f"(real work may exceed {MAX_SESSION_HOURS}h)")


def report_verdict(events, kept):
    section("GO / NO-GO - your call")
    print("Look at the session table above and answer honestly:")
    print()
    print("  1. Do those blocks match afternoons you actually remember?")
    print("  2. Are start times roughly when you sat down?")
    print("  3. Is any single session wildly longer than you really worked?")
    print("  4. Did any real work session fail to show up at all?")
    print()
    print("If mostly yes -> Phase 0 passes, the scoring model is sound,")
    print("everything after this is just building.")
    print("If the sessions are a handful of coarse blobs -> Onshape is only")
    print("checkpointing, and the metric needs rethinking before any app code.")
    print()
    print(f"API calls used this run: {api_calls_made} (budget was 10)")


# ---------------------------------------------------------------------------

def main():
    headers = load_credentials()

    section("1. AUTH + FETCH")
    who = api_get("/v6/users/sessioninfo", headers)
    print(f"Authenticated as : {who.get('name', '?')}")
    print(f"Onshape user id  : {who.get('id', '?')}")
    print(f"Document         : {DOCUMENT_ID}")
    print(f"Workspace        : {WORKSPACE_ID}")
    print()
    print("Fetching documenthistory...")

    events, truncated = fetch_history(headers)

    if not events:
        print("\nNo microversions returned. Either the workspace is empty or")
        print("the ids are wrong. Nothing to validate.")
        sys.exit(1)

    report_count(events, truncated)
    dump_timestamps(events)
    report_gaps(events)
    sessions = cluster_sessions(events)
    kept = report_sessions(sessions)
    report_totals(events, sessions, kept)
    report_verdict(events, kept)


if __name__ == "__main__":
    main()
