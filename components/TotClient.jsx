"use client";

import { useEffect, useMemo, useState } from "react";

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  return { ok: response.ok, status: response.status, data };
}

function formatStickyDate(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return { date: "", weekday: "" };
  return {
    date: new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(date),
    weekday: new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(date)
  };
}

export default function TotClient() {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [passwordUnset, setPasswordUnset] = useState(false);
  const [notes, setNotes] = useState([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const newest = useMemo(() => notes[0] || null, [notes]);

  useEffect(() => {
    loadNotes();
  }, []);

  async function loadNotes() {
    setLoading(true);
    setNote("");
    try {
      const response = await requestJson("/api/tot/notes");
      if (response.ok) {
        setAuthorized(true);
        setPasswordUnset(false);
        setNotes(response.data.notes || []);
      } else if (response.status === 403 && response.data.error === "password_unset") {
        setPasswordUnset(true);
        setAuthorized(false);
      } else {
        setAuthorized(false);
      }
    } catch {
      setNote("便利贴暂时打不开");
    } finally {
      setLoading(false);
    }
  }

  async function login(event) {
    event.preventDefault();
    if (!password.trim()) return;
    setBusy(true);
    setNote("");
    try {
      const response = await requestJson("/api/tot/login", {
        method: "POST",
        body: { password }
      });
      if (!response.ok) {
        setNote(response.data.error === "password_unset" ? "这里还没有开放" : "密码好像不对");
        setBusy(false);
        return;
      }
      setPassword("");
      await loadNotes();
    } catch {
      setNote("便利贴暂时打不开");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await requestJson("/api/tot/logout", { method: "POST" });
    setAuthorized(false);
    setNotes([]);
  }

  return (
    <main className="page-shell tot-shell" aria-labelledby="totTitle">
      <section className="panel-page tot-panel">
        <header className="panel-header tot-header">
          <a className="soft-link panel-back" href="/">回到信箱</a>
          <h1 id="totTitle">ToT 便利贴</h1>
          {authorized ? <p>这里收着一些临时冒出来的话。</p> : null}
        </header>

        {!authorized ? (
          <form className="sticky-login-note" onSubmit={login}>
            <label>
              <span>进入口令</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                disabled={passwordUnset || loading}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="send-button"
              disabled={busy || passwordUnset || loading}
            >
              <span>{busy ? "确认中" : "进入"}</span>
            </button>
            <p className={`form-note ${note || passwordUnset ? "show" : ""}`} aria-live="polite">
              {passwordUnset ? "这张便利贴暂时还没有开放。" : note}
            </p>
          </form>
        ) : (
          <section className="sticky-board" aria-label="便利贴列表">
            <div className="sticky-board-toolbar">
              <p>{notes.length ? `${notes.length} 张便利贴` : "还没有便利贴"}</p>
              <button type="button" className="text-button" onClick={logout}>收起</button>
            </div>
            {newest ? (
              <p className="sticky-board-hint">
                最近一张来自 {newest.locationRegion || "某处"}
              </p>
            ) : null}
            <div className="sticky-note-list">
              {notes.length ? (
                notes.map((item) => {
                  const dateParts = formatStickyDate(item.createdAt);
                  return (
                    <article className="tot-note-card" key={item.id}>
                      <div className="tot-note-meta">
                        <time>{dateParts.date}</time>
                        <span>{dateParts.weekday}</span>
                        <span>{item.locationRegion || "未写地点"}</span>
                      </div>
                      <p>{item.content}</p>
                    </article>
                  );
                })
              ) : (
                <p className="empty-state">这里还没有被贴上的碎碎念。</p>
              )}
            </div>
          </section>
        )}
      </section>
      <footer className="site-footer">ToT · To Tyycc</footer>
    </main>
  );
}
