"use client";

import { useEffect, useMemo, useState } from "react";
import { PublicMessageCard, formatIsoDate, formatTime } from "./MessageCard";

function readLikedMessages() {
  try {
    return JSON.parse(window.localStorage.getItem("totLikedMessages") || "[]");
  } catch {
    return [];
  }
}

function saveLikedMessages(messages) {
  try {
    window.localStorage.setItem("totLikedMessages", JSON.stringify(messages));
  } catch {
    // Likes still update on the server if local storage is blocked.
  }
}

function markSocialWebview() {
  const ua = navigator.userAgent || "";
  if (/MicroMessenger|QQ\/|MQQBrowser/i.test(ua)) {
    document.documentElement.classList.add("social-webview");
  }
}

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
  return { ok: response.ok, data };
}

function searchText(message) {
  return [
    message.displayName,
    message.content,
    message.reply,
    formatTime(message.createdAt),
    formatIsoDate(message.createdAt)
  ]
    .join(" ")
    .toLowerCase();
}

export default function PublicClient({ initialMessages }) {
  const [messages, setMessages] = useState(initialMessages || []);
  const [query, setQuery] = useState("");
  const [likedMessages, setLikedMessages] = useState(new Set());

  useEffect(() => {
    markSocialWebview();
    setLikedMessages(new Set(readLikedMessages().map(String)));
    loadMessages();
  }, []);

  const filteredMessages = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return messages;
    return messages.filter((message) => searchText(message).includes(value));
  }, [messages, query]);

  async function loadMessages() {
    try {
      const response = await requestJson("/api/public/messages");
      if (response.ok) setMessages(response.data.messages || []);
    } catch {
      // Keep server-rendered content.
    }
  }

  async function likeMessage(id) {
    if (likedMessages.has(String(id))) return;
    try {
      const response = await requestJson(`/api/public/messages/${encodeURIComponent(id)}/like`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("like_failed");
      const nextLiked = new Set(likedMessages);
      nextLiked.add(String(id));
      setLikedMessages(nextLiked);
      saveLikedMessages([...nextLiked]);
      setMessages((current) =>
        current.map((message) =>
          String(message.id) === String(id) ? { ...message, likes: response.data.likes } : message
        )
      );
    } catch {
      // Stay quiet.
    }
  }

  return (
    <main className="page-shell public-shell" aria-labelledby="publicTitle">
      <section className="panel-page">
        <header className="panel-header">
          <a className="soft-link panel-back" href="/">回到信箱</a>
          <div className="mascot small-mascot" aria-hidden="true">T o T</div>
          <h1 id="publicTitle">公开的信</h1>
          <p>这些话已经被允许轻轻放在这里。</p>
        </header>

        <label className="search-box" htmlFor="publicSearch">
          <span>搜索</span>
          <input
            id="publicSearch"
            type="search"
            autoComplete="off"
            placeholder="输入关键词或日期"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="message-list" aria-live="polite">
          {filteredMessages.length ? (
            filteredMessages.map((message) => (
              <PublicMessageCard
                key={message.id}
                message={message}
                liked={likedMessages.has(String(message.id))}
                onLike={likeMessage}
              />
            ))
          ) : (
            <p className="empty-state">{query ? "没有找到对应的信。" : "这里还没有被公开的信。"}</p>
          )}
        </div>
      </section>
      <footer className="site-footer">ToT · To Tyycc</footer>
    </main>
  );
}
