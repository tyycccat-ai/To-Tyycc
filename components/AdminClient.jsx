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

function ReplyEditor({ message, onConfirm, busy }) {
  const [reply, setReply] = useState(message.reply || "");
  const original = message.reply || "";
  const changed = reply.trim() !== original.trim();
  const hasReply = Boolean(original.trim()) && !changed;
  const canConfirm = !busy && !hasReply;

  useEffect(() => {
    setReply(message.reply || "");
  }, [message.id, message.reply]);

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
          className={`text-button reply-confirm-button${hasReply ? " is-confirmed" : ""}${busy ? " is-busy" : ""}`}
          disabled={!canConfirm}
          onClick={() => onConfirm(message.id, reply)}
        >
          {busy ? "确认中" : hasReply ? "已回信" : "确认回信"}
        </button>
      </div>
    </>
  );
}

function actionKey(id, action) {
  return `${id}:${action}`;
}

export default function AdminClient() {
  const [password, setPassword] = useState("");
  const [messages, setMessages] = useState([]);
  const [authorized, setAuthorized] = useState(false);
  const [note, setNote] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

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
    setLoginBusy(true);
    let response;
    try {
      response = await requestJson("/api/admin/login", {
        method: "POST",
        body: { password }
      });
    } catch {
      setLoginBusy(false);
      setNote("信箱暂时打不开");
      return;
    }
    setLoginBusy(false);
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

  async function updateMessage(id, body, failureText, action) {
    const key = actionKey(id, action);
    setBusyAction(key);
    setNote("");
    setMessages((current) =>
      current.map((message) => {
        if (String(message.id) !== String(id)) return message;
        const nextMessage = { ...message };
        if ("isPublic" in body) nextMessage.isPublic = Boolean(body.isPublic);
        if ("reply" in body) nextMessage.reply = String(body.reply || "").trim();
        return nextMessage;
      })
    );

    let response;
    try {
      response = await requestJson(`/api/admin/messages/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body
      });
    } catch {
      setBusyAction("");
      setNote(failureText);
      await loadMessages();
      return;
    }
    setBusyAction("");
    if (!response.ok) {
      setNote(failureText);
      await loadMessages();
      return;
    }
  }

  async function removeMessage(id) {
    const key = actionKey(id, "delete");
    setBusyAction(key);
    setNote("");
    setMessages((current) => current.filter((message) => String(message.id) !== String(id)));
    let response;
    try {
      response = await requestJson(`/api/admin/messages/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
    } catch {
      setBusyAction("");
      setNote("这封信暂时删不掉");
      await loadMessages();
      return;
    }
    setBusyAction("");
    if (!response.ok) {
      setNote("这封信暂时删不掉");
      await loadMessages();
      return;
    }
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
            <button type="submit" className="send-button" disabled={loginBusy}>
              {loginBusy ? "进入中" : "进入"}
            </button>
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
                  const deleting = busyAction === actionKey(message.id, "delete");
                  const publishing = busyAction === actionKey(message.id, "publish");
                  const unpublishing = busyAction === actionKey(message.id, "unpublish");
                  const replying = busyAction === actionKey(message.id, "reply");
                  const messageBusy = busyAction.startsWith(`${message.id}:`);
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
                        busy={replying}
                        onConfirm={(id, reply) =>
                          updateMessage(id, { reply }, "这封回信暂时确认不了", "reply")
                        }
                      />
                      <div className="message-actions">
                        <button
                          type="button"
                          className={`text-button danger-button${deleting ? " is-busy" : ""}`}
                          disabled={messageBusy}
                          onClick={() => removeMessage(message.id)}
                        >
                          {deleting ? "删除中" : "删除"}
                        </button>
                        {message.isPublic ? (
                          <button
                            type="button"
                            className={`text-button publish-button unpublish-button${unpublishing ? " is-busy" : ""}`}
                            disabled={messageBusy}
                            onClick={() =>
                              updateMessage(
                                message.id,
                                { isPublic: false },
                                "这封信暂时改不了公开状态",
                                "unpublish"
                              )
                            }
                          >
                            {unpublishing ? "取消中" : "取消公开"}
                          </button>
                        ) : message.allowPublic ? (
                          <button
                            type="button"
                            className={`text-button publish-button${publishing ? " is-busy" : ""}`}
                            disabled={messageBusy}
                            onClick={() =>
                              updateMessage(
                                message.id,
                                { isPublic: true },
                                "这封信暂时改不了公开状态",
                                "publish"
                              )
                            }
                          >
                            {publishing ? "公开中" : "公开"}
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
