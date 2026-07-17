"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

function ReplyArea({ message, onConfirm, onAdd, busy, supplementBusy, note }) {
  const [reply, setReply] = useState(message.reply || "");
  const [supplementOpen, setSupplementOpen] = useState(false);
  const [supplementDraft, setSupplementDraft] = useState("");
  const supplementInputRef = useRef(null);
  const original = message.reply || "";
  const supplements = message.replySupplements || [];
  const supplement = supplements[0] || null;
  const supplementOriginal = supplement?.content || "";
  const changed = reply.trim() !== original.trim();
  const hasReply = Boolean(original.trim());
  const canConfirm = !busy && changed && Boolean(reply.trim());
  const supplementChanged = supplementDraft.trim() !== supplementOriginal.trim();
  const canSubmitSupplement =
    !supplementBusy && Boolean(supplementDraft.trim()) && (!supplement || supplementChanged);
  const buttonText = busy
    ? "确认中"
    : changed
      ? hasReply
        ? "确认修改"
        : "确认回信"
      : hasReply
        ? "已回信"
        : "确认回信";

  useEffect(() => {
    setReply(message.reply || "");
  }, [message.id, message.reply]);

  useEffect(() => {
    setSupplementDraft(supplement?.content || "");
    setSupplementOpen(false);
  }, [message.id, supplement?.id, supplement?.content]);

  function toggleSupplement() {
    setSupplementOpen((value) => !value);
    setSupplementDraft(supplement?.content || "");
    setTimeout(() => supplementInputRef.current?.focus(), 0);
  }

  function submitSupplement() {
    if (!supplementDraft.trim()) {
      supplementInputRef.current?.focus();
      return;
    }
    onAdd(message.id, supplementDraft, (savedSupplement) => {
      setSupplementDraft(savedSupplement?.content || supplementDraft);
      setSupplementOpen(false);
    });
  }

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
          className={`text-button reply-confirm-button${hasReply && !changed ? " is-confirmed" : ""}${busy ? " is-busy" : ""}`}
          disabled={!canConfirm}
          onClick={() => onConfirm(message.id, reply)}
        >
          {buttonText}
        </button>
        {hasReply && !supplement ? (
          <button
            type="button"
            className="text-button reply-confirm-button supplement-toggle"
            disabled={supplementBusy}
            onClick={toggleSupplement}
          >
            补充
          </button>
        ) : null}
      </div>

      {hasReply ? (
        <section className="supplement-section" aria-label="补充回信">
          {supplement ? (
            <div className="supplement-list">
              <article className="supplement-item" key={supplement.id}>
                <div className="supplement-meta">
                  <span>补充回信</span>
                  <time>{formatTime(supplement.createdAt, {
                    dateStyle: "medium",
                    timeStyle: "short"
                  })}</time>
                </div>
                <p>{supplement.content}</p>
              </article>
            </div>
          ) : null}

          {supplement && !supplementOpen ? (
            <button
              type="button"
              className="text-button reply-confirm-button supplement-toggle is-confirmed"
              disabled={supplementBusy}
              onClick={toggleSupplement}
            >
              已补充
            </button>
          ) : null}

          {supplementOpen ? (
            <div className="supplement-editor">
              <textarea
                ref={supplementInputRef}
                value={supplementDraft}
                maxLength={3000}
                rows={3}
                placeholder="继续写一封补充回信"
                onChange={(event) => setSupplementDraft(event.target.value)}
              />
              <button
                type="button"
                className={`text-button reply-confirm-button${supplement && !supplementChanged ? " is-confirmed" : ""}${supplementBusy ? " is-busy" : ""}`}
                disabled={!canSubmitSupplement}
                onClick={submitSupplement}
              >
                {supplementBusy ? "补充中" : supplement ? (supplementChanged ? "确认修改" : "已补充") : "确认补充"}
              </button>
              <p className={`form-note supplement-note ${note ? "show" : ""}`} aria-live="polite">
                {note}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function StickyAdmin() {
  const [notes, setNotes] = useState([]);
  const [content, setContent] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [durationHours, setDurationHours] = useState("24");
  const [expiresAt, setExpiresAt] = useState("");
  const [passwordSet, setPasswordSet] = useState(false);
  const [note, setNote] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editContent, setEditContent] = useState("");
  const [stickyDeleteTarget, setStickyDeleteTarget] = useState(null);

  useEffect(() => {
    loadStickyNotes();
  }, []);

  async function loadStickyNotes() {
    const response = await requestJson("/api/admin/sticky-notes");
    if (!response.ok) {
      setNote("便利贴暂时打不开");
      return;
    }
    setNotes(response.data.notes || []);
    setPasswordSet(Boolean(response.data.passwordSet));
    setCurrentPassword(response.data.currentPassword || "");
    setDurationHours(String(response.data.durationHours || 24));
    setExpiresAt(response.data.expiresAt || "");
    if (response.data.rotated) {
      setNote("上一枚访问密码已过期，系统已经自动生成了新密码。");
    }
  }

  async function publishSticky(event) {
    event.preventDefault();
    if (!content.trim()) return;
    setBusyAction("create");
    setNote("");
    const response = await requestJson("/api/admin/sticky-notes", {
      method: "POST",
      body: { content, location: "" }
    });
    setBusyAction("");
    if (!response.ok) {
      setNote("这张便利贴暂时贴不上去");
      return;
    }
    setNotes((current) => [response.data.note, ...current]);
    setContent("");
  }

  async function generatePassword(event) {
    event.preventDefault();
    setBusyAction("password");
    setNote("");
    const response = await requestJson("/api/admin/sticky-password", {
      method: "PATCH",
      body: { durationHours }
    });
    setBusyAction("");
    if (!response.ok) {
      setNote("访问密码暂时生成不了");
      return;
    }
    setPasswordSet(true);
    setCurrentPassword(response.data.currentPassword || "");
    setDurationHours(String(response.data.durationHours || durationHours));
    setExpiresAt(response.data.expiresAt || "");
    setNote("新的访问密码已经生成，旧口令会立刻失效。");
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditContent(item.content || "");
    setNote("");
  }

  function cancelEdit() {
    setEditingId("");
    setEditContent("");
  }

  async function saveEdit(id) {
    if (!editContent.trim()) return;
    setBusyAction(`edit:${id}`);
    setNote("");
    const response = await requestJson(`/api/admin/sticky-notes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { content: editContent, location: "" }
    });
    setBusyAction("");
    if (!response.ok) {
      setNote("这张便利贴暂时改不了");
      return;
    }
    setNotes((current) =>
      current.map((item) => (String(item.id) === String(id) ? response.data.note : item))
    );
    cancelEdit();
  }

  async function removeSticky(id) {
    setBusyAction(`delete:${id}`);
    setNote("");
    const response = await requestJson(`/api/admin/sticky-notes/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    setBusyAction("");
    if (!response.ok) {
      setNote("这张便利贴暂时撕不下来");
      return;
    }
    setNotes((current) => current.filter((item) => String(item.id) !== String(id)));
    setStickyDeleteTarget(null);
  }

  return (
    <section className="sticky-admin-panel" aria-label="ToT 便利贴管理">
      <form className="sticky-password-form" onSubmit={generatePassword}>
        <label>
          <span>有效时间</span>
          <select
            value={durationHours}
            onChange={(event) => setDurationHours(event.target.value)}
          >
            <option value="12">12 小时</option>
            <option value="24">24 小时</option>
            <option value="48">48 小时</option>
            <option value="72">72 小时</option>
            <option value="168">7 天</option>
          </select>
        </label>
        <button type="submit" className="text-button reply-confirm-button" disabled={busyAction === "password"}>
          {busyAction === "password" ? "生成中" : passwordSet ? "重新生成" : "生成访问密码"}
        </button>
      </form>
      {passwordSet ? (
        <div className="sticky-password-card" aria-label="当前 ToT 便利贴访问密码">
          <span>当前访问密码</span>
          <strong>{currentPassword}</strong>
          <time>{expiresAt ? `有效至 ${formatTime(expiresAt, {
            dateStyle: "medium",
            timeStyle: "short"
          })}` : "未设置到期时间"}</time>
        </div>
      ) : null}

      <form className="sticky-compose-form" onSubmit={publishSticky}>
        <label>
          <span>碎碎念</span>
          <textarea
            rows={4}
            maxLength={2000}
            placeholder="写一点现在想贴住的话"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </label>
        <button type="submit" className="send-button" disabled={busyAction === "create"}>
          <span>{busyAction === "create" ? "贴上中" : "贴上便利贴"}</span>
        </button>
      </form>

      <p className={`form-note sticky-admin-note ${note ? "show" : ""}`} aria-live="polite">
        {note}
      </p>

      <div className="sticky-admin-list">
        {notes.length ? (
          notes.map((item) => {
            const editing = editingId === item.id;
            const busy = busyAction.endsWith(`:${item.id}`);
            return (
              <article className="sticky-admin-item" key={item.id}>
                {editing ? (
                  <>
                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={editContent}
                      onChange={(event) => setEditContent(event.target.value)}
                    />
                  </>
                ) : (
                  <>
                    <div className="message-meta">
                      <time>{formatTime(item.createdAt, {
                        dateStyle: "medium",
                        timeStyle: "short"
                      })}</time>
                    </div>
                    <p>{item.content}</p>
                  </>
                )}
                <div className="message-actions">
                  {editing ? (
                    <>
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy}
                        onClick={cancelEdit}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        className="text-button publish-button"
                        disabled={busy}
                        onClick={() => saveEdit(item.id)}
                      >
                        {busy ? "保存中" : "保存"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy}
                        onClick={() => startEdit(item)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="text-button danger-button"
                        disabled={busy}
                        onClick={() => setStickyDeleteTarget(item)}
                      >
                        {busyAction === `delete:${item.id}` ? "删除中" : "删除"}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <p className="empty-state">还没有便利贴。</p>
        )}
      </div>
      {stickyDeleteTarget ? (
        <div className="admin-confirm-backdrop" role="presentation">
          <section
            className="admin-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stickyDeleteConfirmTitle"
          >
            <h2 id="stickyDeleteConfirmTitle">是否确认删除该便利贴？</h2>
            <div className="admin-confirm-actions">
              <button
                type="button"
                className="text-button confirm-delete-button"
                disabled={busyAction === `delete:${stickyDeleteTarget.id}`}
                onClick={() => removeSticky(stickyDeleteTarget.id)}
              >
                {busyAction === `delete:${stickyDeleteTarget.id}` ? "删除中" : "是"}
              </button>
              <button
                type="button"
                className="text-button confirm-cancel-button"
                disabled={busyAction === `delete:${stickyDeleteTarget.id}`}
                onClick={() => setStickyDeleteTarget(null)}
              >
                否
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function actionKey(id, action) {
  return `${id}:${action}`;
}

export default function AdminClient() {
  const [password, setPassword] = useState("");
  const [messages, setMessages] = useState([]);
  const [authorized, setAuthorized] = useState(false);
  const [adminView, setAdminView] = useState("menu");
  const [note, setNote] = useState("");
  const [supplementNotes, setSupplementNotes] = useState({});
  const [busyAction, setBusyAction] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

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
    setAdminView("menu");
    await loadMessages();
  }

  async function logout() {
    await requestJson("/api/admin/logout", { method: "POST" });
    setAuthorized(false);
    setAdminView("menu");
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

  async function addSupplement(id, supplementReply, onSuccess) {
    const key = actionKey(id, "supplement");
    setBusyAction(key);
    setNote("");
    setSupplementNotes((current) => ({ ...current, [id]: "" }));

    let response;
    try {
      response = await requestJson(`/api/admin/messages/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { supplementReply }
      });
    } catch {
      setBusyAction("");
      setSupplementNotes((current) => ({
        ...current,
        [id]: "这封补充回信暂时送不出去"
      }));
      await loadMessages();
      return;
    }
    setBusyAction("");
    if (!response.ok || !response.data.supplement) {
      setSupplementNotes((current) => ({
        ...current,
        [id]: "这封补充回信暂时送不出去"
      }));
      await loadMessages();
      return;
    }

    setMessages((current) =>
      current.map((message) =>
        String(message.id) === String(id)
          ? {
              ...message,
              replySupplements: [response.data.supplement]
            }
          : message
      )
    );
    setSupplementNotes((current) => ({ ...current, [id]: "" }));
    onSuccess?.(response.data.supplement);
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
    setDeleteTarget(null);
  }

  return (
    <main className="page-shell admin-shell" aria-labelledby="adminTitle">
      <section className="panel-page">
        <header className="panel-header">
          <Link className="soft-link panel-back" href="/" prefetch>返回匿名信箱</Link>
          <h1 id="adminTitle">
            {!authorized
              ? "Tyycc 的信箱"
              : adminView === "mailbox"
                ? "Tyycc 的信箱"
                : adminView === "sticky"
                  ? "ToT 便利贴"
                  : "管理页面"}
          </h1>
          <p>
            {!authorized
              ? "这里会收好每一封匿名信。"
              : adminView === "mailbox"
                ? "这里会收好每一封匿名信。"
                : adminView === "sticky"
                  ? "先生成访问密码，这里才会开放。"
                  : "选择你要管理的内容。"}
          </p>
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
        ) : adminView === "menu" ? (
          <section className="admin-menu" aria-label="管理入口">
            <button type="button" className="admin-menu-card" onClick={() => setAdminView("mailbox")}>
              <span>信箱</span>
              <strong>Tyycc 的信箱</strong>
            </button>
            <button type="button" className="admin-menu-card" onClick={() => setAdminView("sticky")}>
              <span>便利贴</span>
              <strong>ToT 便利贴</strong>
            </button>
            <button type="button" className="text-button admin-menu-logout" onClick={logout}>
              退出
            </button>
          </section>
        ) : adminView === "sticky" ? (
          <section className="admin-board" aria-label="便利贴管理">
            <div className="board-toolbar board-toolbar-return">
              <button type="button" className="text-button" onClick={() => setAdminView("menu")}>
                返回管理页面
              </button>
            </div>
            <StickyAdmin />
          </section>
        ) : (
          <section className="admin-board" aria-label="留言管理">
            <div className="board-toolbar">
              <p>{messages.length} 封信</p>
              <button type="button" className="text-button" onClick={() => setAdminView("menu")}>
                返回管理页面
              </button>
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
                  const supplementing = busyAction === actionKey(message.id, "supplement");
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
                      <ReplyArea
                        message={message}
                        busy={messageBusy || replying}
                        onConfirm={(id, reply) =>
                          updateMessage(id, { reply }, "这封回信暂时确认不了", "reply")
                        }
                        supplementBusy={messageBusy || supplementing}
                        note={supplementNotes[message.id] || ""}
                        onAdd={addSupplement}
                      />
                      <div className="message-actions">
                        <button
                          type="button"
                          className={`text-button danger-button${deleting ? " is-busy" : ""}`}
                          disabled={messageBusy}
                          onClick={() => setDeleteTarget(message)}
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
            {deleteTarget ? (
              <div className="admin-confirm-backdrop" role="presentation">
                <section
                  className="admin-confirm-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="deleteConfirmTitle"
                >
                  <h2 id="deleteConfirmTitle">确认删除这封信吗？</h2>
                  <div className="admin-confirm-actions">
                    <button
                      type="button"
                      className="text-button confirm-delete-button"
                      disabled={busyAction === actionKey(deleteTarget.id, "delete")}
                      onClick={() => removeMessage(deleteTarget.id)}
                    >
                      {busyAction === actionKey(deleteTarget.id, "delete") ? "删除中" : "是"}
                    </button>
                    <button
                      type="button"
                      className="text-button confirm-cancel-button"
                      disabled={busyAction === actionKey(deleteTarget.id, "delete")}
                      onClick={() => setDeleteTarget(null)}
                    >
                      否
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </section>
        )}
      </section>
      <footer className="site-footer">ToT · To Tyycc</footer>
    </main>
  );
}
