"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { LeagueSummary } from "@/lib/db/leagues";
import { invitePath } from "@/lib/invite";
import { Icon } from "./Icon";

export function LeagueManage({
  leagueId,
  leagueName,
  joinCode,
  isOwner,
  allLeagues,
  tablesReady,
}: {
  leagueId: string | null;
  leagueName: string;
  joinCode: string | null;
  isOwner: boolean;
  allLeagues: LeagueSummary[];
  tablesReady: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rename, setRename] = useState(leagueName);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState(joinCode ? invitePath(joinCode) : "");

  useEffect(() => {
    setRename(leagueName);
  }, [leagueName]);

  useEffect(() => {
    if (!joinCode) return;
    setShareUrl(`${window.location.origin}${invitePath(joinCode)}`);
  }, [joinCode]);

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
          <p className="t-footnote dim" style={{ margin: "0 0 10px" }}>Join code · share it or the link below</p>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <span className="code-chip">{joinCode}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => {
                const url = `${window.location.origin}${invitePath(joinCode)}`;
                void navigator.clipboard.writeText(url).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                }).catch(() => {
                  /* clipboard permission denied — the path is still visible */
                });
              }}
            >
              <Icon name={copied ? "check" : "copy"} size={15} />
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className="t-caption dimmer" style={{ margin: "10px 0 0", wordBreak: "break-all" }}>
            {shareUrl}
          </p>
          {isOwner && leagueId ? (
            <div className="stack" style={{ gap: 10, marginTop: 10 }}>
              <form
                className="stack"
                style={{ gap: 8 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  void post("/api/leagues/rename", { leagueId, name: rename });
                }}
              >
                <label className="field">
                  <span className="field__label">League name</span>
                  <input
                    className="field__input"
                    value={rename}
                    onChange={(e) => setRename(e.target.value)}
                    maxLength={48}
                    disabled={busy}
                  />
                </label>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={busy || rename.trim().length < 2 || rename.trim() === leagueName}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => void post("/api/leagues/regenerate-code", { leagueId })}
                  >
                    New join code
                  </button>
                </div>
              </form>
            </div>
          ) : null}
          {leagueId ? (
            <button
              type="button"
              className="btn-ghost-danger"
              disabled={busy}
              onClick={() => void post("/api/leagues/leave", { leagueId })}
              style={{ marginTop: 14 }}
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
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || name.trim().length < 2}>
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
            placeholder="ABC234"
            autoCapitalize="characters"
            disabled={busy}
          />
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || code.trim().length < 4}>
          Join
        </button>
      </form>

      {error ? (
        <p className="t-footnote" style={{ margin: 0, color: "var(--neg, #b42318)" }}>{error}</p>
      ) : null}
    </div>
  );
}
