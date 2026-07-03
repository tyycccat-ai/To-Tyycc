"use client";

import { useEffect, useState } from "react";
import { formatTime } from "./MessageCard";

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

function ReplyEditor({ message, onConfirm }) {
  const [reply, setReply] = useState(message.reply || "");
  const original = message.reply || "";
  const changed = reply.trim() !== original.trim();
  const hasReply = Boolean(original.trim()) && !changed;

  return (
    <>
      <label className="reply-editor">
        <span>回信</span>
        <textarea
          value={reply}
          maxLength={3000}
          rows={3}
          placeholder="写一封只属于这条留言的回信"
          onChange={(event) => setReply(event.target.value)}
        />
      </label>
      <div className="reply-actions">
        <button
          type="button"
          className={`text-button reply-confirm-button${hasReply ? " is-confirmed" : ""}`}
          disabled={hasReply}
          onClick={() => onConfirm(message.id, reply)}
        >
          {hasReply ? "已回信" : "确认回信"}
        </button>
      </div>
    </>
  );
}

export default function AdminClient() {
  const [password, setPassword] = useState("");
  const [messages, setMessages] = useState([]);
  const [authorized, setAuthorized] = useState(false);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    loadMessages();
  }, []);

  async function loadMessages() {
    const response = await requestJson("/api/admin/messages");
    if (response.status === 401) {
      setAuthorized(false);
      return;
    }
    if (!response.ok) {
      setNote("信箱暂时打不开");
      return;
    }
    setAuthorized(true);
    setNote("");
    setMessages(response.data.messages || []);
  }

  async function login(event) {
    event.preventDefault();
    setNote("");
    const response = await requestJson("/api/admin/login", {
      method: "POST",
      body: { password }
    });
    if (!response.ok) {
      setNote("密码好像不对");
      return;
    }
    setPassword("");
    await loadMessages();
  }

  async function logout() {
    await requestJson("/api/admin/logout", { method: "POST" });
    setAuthorized(false);
    setMessages([]);
  }

  async function updateMessage(id, body, failureText) {
    setBusyId(String(id));
    const response = await requestJson(`/api/admin/messages/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body
    });
    setBusyId("");
    if (!response.ok) {
      setNote(failureText);
      await loadMessages();
      return;
    }
    await loadMessages();
  }

  async function removeMessage(id) {
    setBusyId(String(id));
    const response = await requestJson(`/api/admin/messages/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    setBusyId("");
    if (!response.ok) {
      setNote("这封信暂时删不掉");
      return;
    }
    await loadMessages();
  }

  return (
    <main className="page-shell admin-shell" aria-labelledby="adminTitle">
      <section className="panel-page">
        <header className="panel-header">
          <a className="soft-link panel-back" href="/">返回信箱</a>
          <h1 id="adminTitle">Tyycc 的信箱</h1>
          <p>这里会收好每一封匿名信。</p>
        </header>

        {!authorized ? (
          <form className="admin-login" onSubmit={login}>
            <label className="admin-password-row">
              <span>管理员密码</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button type="submit" className="send-button">进入</button>
            <p className={`form-note ${note ? "show" : ""}`} aria-live="polite">{note}</p>
          </form>
        ) : (
          <section className="admin-board" aria-label="留言管理">
            <div className="board-toolbar">
              <p>{messages.length} 封信</p>
              <button type="button" className="text-button" onClick={logout}>退出</button>
            </div>
            <p className={`form-note ${note ? "show" : ""}`} aria-live="polite">{note}</p>
            <div className="message-list">
              {messages.length ? (
                messages.map((message) => {
                  const nickname = message.nickname?.trim() || "匿名";
                  return (
                    <article className="message-card" key={message.id}>
                      <div className="message-meta">
                        <span>{nickname}</span>
                        <time>{formatTime(message.createdAt, {
                          dateStyle: "medium",
                          timeStyle: "short"
                        })}</time>
                      </div>
                      <p>{message.content}</p>
                      <div className="message-flags">
                        <span>{message.allowPublic ? "允许公开：是" : "允许公开：否"}</span>
                        <span>{message.isPublic ? "已公开：是" : "已公开：否"}</span>
                        <span>{message.likes || 0} 个喜欢</span>
                      </div>
                      <ReplyEditor
                        message={message}
                        onConfirm={(id, reply) =>
                          updateMessage(id, { reply }, "这封回信暂时确认不了")
                        }
                      />
                      <div className="message-actions">
                        <button
                          type="button"
                          className="text-button danger-button"
                          disabled={busyId === String(message.id)}
                          onClick={() => removeMessage(message.id)}
                        >
                          删除
                        </button>
                        {message.isPublic ? (
                          <button
                            type="button"
                            className="text-button publish-button unpublish-button"
                            disabled={busyId === String(message.id)}
                            onClick={() =>
                              updateMessage(
                                message.id,
                                { isPublic: false },
                                "这封信暂时改不了公开状态"
                              )
                            }
                          >
                            取消公开
                          </button>
                        ) : message.allowPublic ? (
                          <button
                            type="button"
                            className="text-button publish-button"
                            disabled={busyId === String(message.id)}
                            onClick={() =>
                              updateMessage(
                                message.id,
                                { isPublic: true },
                                "这封信暂时改不了公开状态"
                              )
                            }
                          >
                            公开
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="empty-state">还没有新的信。</p>
              )}
            </div>
          </section>
        )}
      </section>
      <footer className="site-footer">ToT · To Tyycc</footer>
    </main>
  );
}
