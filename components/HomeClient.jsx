"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PublicMessageCard } from "./MessageCard";

const letterReceiptKey = "totLetterReceipts";
const activeReplyKey = "totActiveReplyLetter";

function readJson(key, fallback) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The core flow still works if storage is blocked.
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
  return { ok: response.ok, status: response.status, data };
}

function markSocialWebview() {
  const ua = navigator.userAgent || "";
  if (/MicroMessenger|QQ\/|MQQBrowser/i.test(ua)) {
    document.documentElement.classList.add("social-webview");
  }
}

function rememberLetter(letter) {
  if (!letter?.id || !letter?.receiptToken) return;
  const receipts = readJson(letterReceiptKey, []).filter(
    (receipt) => String(receipt.id) !== String(letter.id)
  );
  receipts.unshift({
    id: letter.id,
    receiptToken: letter.receiptToken,
    seenReplyUpdatedAt: ""
  });
  writeJson(letterReceiptKey, receipts.slice(0, 30));
}

function markReplyAsRead(letter) {
  const updatedAt = String(letter.replyUpdatedAt || letter.id);
  const receipts = readJson(letterReceiptKey, []).map((receipt) =>
    String(receipt.id) === String(letter.id)
      ? { ...receipt, seenReplyUpdatedAt: updatedAt }
      : receipt
  );
  writeJson(letterReceiptKey, receipts);
}

export default function HomeClient({ initialMessages }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [nickname, setNickname] = useState("");
  const [allowPublic, setAllowPublic] = useState(false);
  const [mascot, setMascot] = useState("T o T");
  const [mascotState, setMascotState] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [deliveryVisible, setDeliveryVisible] = useState(false);
  const [deliveryLeaving, setDeliveryLeaving] = useState(false);
  const [publicMessages, setPublicMessages] = useState(initialMessages || []);
  const [likedMessages, setLikedMessages] = useState(new Set());
  const [replyNotice, setReplyNotice] = useState(null);
  const messageRef = useRef(null);
  const receiveTimer = useRef();
  const deliveryTimer = useRef();

  const homeMessages = useMemo(() => publicMessages.slice(0, 3), [publicMessages]);

  useEffect(() => {
    markSocialWebview();
    setLikedMessages(new Set(readJson("totLikedMessages", []).map(String)));
    loadPublicMessages();
    checkReplyLetters();

    return () => {
      clearTimeout(receiveTimer.current);
      clearTimeout(deliveryTimer.current);
    };
  }, []);

  function setMascotMode(mode) {
    if (mode === "listening") {
      setMascot("> o <");
      setMascotState("listening");
      return;
    }
    if (mode === "received") {
      setMascot("T ◡ T");
      setMascotState("received");
      return;
    }
    setMascot("T o T");
    setMascotState("");
  }

  async function loadPublicMessages() {
    try {
      const response = await requestJson("/api/public/messages");
      if (response.ok) setPublicMessages(response.data.messages || []);
    } catch {
      // Keep any server-rendered messages.
    }
  }

  async function checkReplyLetters() {
    const receipts = readJson(letterReceiptKey, []);
    if (!receipts.length) return;
    try {
      const response = await requestJson("/api/replies/lookup", {
        method: "POST",
        body: { receipts }
      });
      if (!response.ok) return;
      const newLetter = (response.data.letters || []).find((letter) => {
        const receipt = receipts.find((item) => String(item.id) === String(letter.id));
        return (
          receipt &&
          String(receipt.seenReplyUpdatedAt || "") !==
            String(letter.replyUpdatedAt || letter.id)
        );
      });
      if (newLetter) {
        const receipt = receipts.find((item) => String(item.id) === String(newLetter.id));
        setReplyNotice({
          ...newLetter,
          receiptToken: receipt?.receiptToken || ""
        });
      }
    } catch {
      // No hint is shown when the reply box cannot be checked.
    }
  }

  function showDeliveryCard() {
    clearTimeout(deliveryTimer.current);
    setDeliveryLeaving(false);
    setDeliveryVisible(true);
    deliveryTimer.current = setTimeout(() => {
      setDeliveryLeaving(true);
      setTimeout(() => {
        setDeliveryVisible(false);
        setDeliveryLeaving(false);
      }, 360);
    }, 2000);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearTimeout(receiveTimer.current);
    setNote("");

    if (!message.trim()) {
      messageRef.current?.focus();
      setMascotMode("listening");
      return;
    }

    setSending(true);
    try {
      const response = await requestJson("/api/messages", {
        method: "POST",
        body: { content: message, nickname, allowPublic }
      });

      if (!response.ok) {
        if (response.status === 429) {
          setNote("先让信箱喘口气，一分钟后再试试");
        } else if (response.status === 400) {
          setNote("这封信里好像有暂时不能投递的内容");
        }
        throw new Error("delivery_failed");
      }

      rememberLetter(response.data.letter);
      setMascotMode("received");
      showDeliveryCard();
      receiveTimer.current = setTimeout(() => {
        setMessage("");
        setNickname("");
        setAllowPublic(false);
        setMascotMode("waiting");
        setSending(false);
        setNote("");
        loadPublicMessages();
      }, 2200);
    } catch {
      setSending(false);
      if (!note) setNote("这封信暂时没有投递出去");
      setMascotMode("listening");
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
      writeJson("totLikedMessages", [...nextLiked]);
      setPublicMessages((messages) =>
        messages.map((item) =>
          String(item.id) === String(id) ? { ...item, likes: response.data.likes } : item
        )
      );
    } catch {
      // A failed like stays quiet.
    }
  }

  function readReply() {
    if (!replyNotice) return;
    const replyLetter = {
      ...replyNotice,
      receiptToken: replyNotice.receiptToken || ""
    };
    try {
      window.sessionStorage.setItem(activeReplyKey, JSON.stringify(replyLetter));
      window.localStorage.setItem(activeReplyKey, JSON.stringify(replyLetter));
    } catch {
      // The reply page can still look up the letter by URL token.
    }
    markReplyAsRead(replyLetter);

    const params = new URLSearchParams();
    params.set("id", replyLetter.id);
    if (replyLetter.receiptToken) params.set("token", replyLetter.receiptToken);
    router.push(`/reply?${params.toString()}`);
  }

  return (
    <main className="page-shell" aria-labelledby="site-title">
      <Link className="home-sticky-link" href="/tot" prefetch aria-label="进入 ToT 便利贴">
        ToT 便利贴
      </Link>
      <section className="hero" aria-label="T o T 匿名留言箱首页">
        <img className="avatar" src="/assets/avatar.jpg" alt="Tyycc 的头像" />

        <div className="mascot-wrap" aria-live="polite">
          <div className={`mascot ${mascotState}`} id="mascot" aria-label="T o T 正在等待">
            {mascot}
          </div>
        </div>

        <h1 className="main-title" id="site-title">匿名信箱</h1>

        <form className="letter-box" onSubmit={handleSubmit}>
          <p className="letter-brand">To Tyycc</p>

          <label className="message-label" htmlFor="message">匿名留言</label>
          <textarea
            ref={messageRef}
            id="message"
            name="message"
            rows={6}
            maxLength={3000}
            placeholder="你想说的话，我都会认真听"
            value={message}
            onChange={(event) => {
              const value = event.target.value;
              setMessage(value);
              setMascotMode(value.trim() ? "listening" : "waiting");
            }}
          />

          <div className="form-row">
            <label className="nickname">
              <span>昵称（选填）</span>
              <input
                type="text"
                name="nickname"
                maxLength={24}
                autoComplete="off"
                aria-label="昵称，选填"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
              />
            </label>
          </div>

          <label className="public-choice">
            <input
              type="checkbox"
              name="allowPublic"
              checked={allowPublic}
              onChange={(event) => setAllowPublic(event.target.checked)}
            />
            <span className="box" aria-hidden="true" />
            <span>允许公开我的留言</span>
          </label>

          <button
            type="submit"
            className="send-button letter-submit-button"
            disabled={sending}
            aria-label="投递匿名留言"
          >
            <span>投递</span>
          </button>
          <p className={`form-note ${note ? "show" : ""}`} aria-live="polite">{note}</p>
        </form>
      </section>

      <section className="home-public" aria-labelledby="homePublicTitle">
        <div className="home-public-heading">
          <h2 id="homePublicTitle">公开的信</h2>
          <Link className="soft-link" href="/public" prefetch>全部</Link>
        </div>
        <div className="message-list" aria-live="polite">
          {homeMessages.length ? (
            homeMessages.map((item) => (
              <PublicMessageCard
                key={item.id}
                message={item}
                liked={likedMessages.has(String(item.id))}
                onLike={likeMessage}
              />
            ))
          ) : (
            <p className="empty-state">这里还没有被公开的信。</p>
          )}
        </div>
      </section>
      <footer className="site-footer">ToT · To Tyycc</footer>

      <div
        className={`letter-float ${deliveryVisible ? "" : "hidden"} ${deliveryVisible ? "show" : ""} ${deliveryLeaving ? "leaving" : ""}`}
        aria-live="polite"
      >
        <div className="letter-float-card">
          <div className="letter-mark" aria-hidden="true">💌</div>
          <p>ToT 已经收到啦。</p>
        </div>
      </div>

      {replyNotice ? (
        <div className="reply-return-card show" aria-live="polite">
          <div className="letter-mark" aria-hidden="true">💌</div>
          <p>ToT 欢迎回来。</p>
          <strong>你有一封新的回信。</strong>
          <button type="button" className="reply-read-button" onClick={readReply}>
            查收
          </button>
        </div>
      ) : null}
    </main>
  );
}
