"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { LeagueSummary } from "@/lib/db/leagues";

export function LeagueManage({
  leagueId,
  joinCode,
  allLeagues,
  tablesReady,
}: {
  leagueId: string | null;
  joinCode: string | null;
  allLeagues: LeagueSummary[];
  tablesReady: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string; id?: string };
      if (!res.ok) throw new Error(json.error || "Request failed");
      if (json.id) router.push(`/league/?league=${json.id}`);
      else router.push("/league/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    void post("/api/leagues/create", { name });
  }

  function onJoin(e: FormEvent) {
    e.preventDefault();
    void post("/api/leagues/join", { code });
  }

  if (!tablesReady) {
    return (
      <section className="chunk chunk-sm" style={{ marginTop: 16 }}>
        <p className="t-footnote dim" style={{ margin: 0 }}>
          Run <code>supabase/migrate-leagues.sql</code> to create and join leagues.
        </p>
      </section>
    );
  }

  return (
    <div className="stack" style={{ gap: 16, marginTop: 18 }}>
      {allLeagues.length > 1 ? (
        <section className="chunk chunk-sm">
          <p className="t-footnote dim" style={{ margin: "0 0 8px" }}>Your leagues</p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {allLeagues.map((l) => (
              <a
                key={l.id}
                href={`/league/?league=${l.id}`}
                className="chip chip-neutral"
                style={{ textDecoration: "none", fontWeight: l.id === leagueId ? 800 : 600 }}
              >
                {l.name}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {joinCode ? (
        <section className="chunk chunk-sm">
          <p className="t-footnote dim" style={{ margin: 0 }}>
            Join code <strong className="num" style={{ color: "var(--label)" }}>{joinCode}</strong>
            {" · "}share it so someone else can join.
          </p>
          {leagueId ? (
            <button
              type="button"
              className="text-btn"
              disabled={busy}
              onClick={() => void post("/api/leagues/leave", { leagueId })}
              style={{ paddingLeft: 0 }}
            >
              Leave this league
            </button>
          ) : null}
        </section>
      ) : null}

      <form className="chunk chunk-sm stack" style={{ gap: 10 }} onSubmit={onCreate}>
        <label className="field">
          <span className="field__label">Create a league</span>
          <input
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={48}
            placeholder="Thursday studio"
            disabled={busy}
          />
        </label>
        <button type="submit" className="text-btn text-btn--strong" disabled={busy || name.trim().length < 2}>
          Create
        </button>
      </form>

      <form className="chunk chunk-sm stack" style={{ gap: 10 }} onSubmit={onJoin}>
        <label className="field">
          <span className="field__label">Join with a code</span>
          <input
            className="field__input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="XTRUDE"
            autoCapitalize="characters"
            disabled={busy}
          />
        </label>
        <button type="submit" className="text-btn text-btn--strong" disabled={busy || code.trim().length < 4}>
          Join
        </button>
      </form>

      {error ? (
        <p className="t-footnote" style={{ margin: 0, color: "var(--neg, #b42318)" }}>{error}</p>
      ) : null}
    </div>
  );
}
