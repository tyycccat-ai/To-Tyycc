"use client";

import { useEffect, useState } from "react";

const letterReceiptKey = "totLetterReceipts";
const activeReplyKey = "totActiveReplyLetter";

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

function formatLetterDate(timestamp) {
  const date =
    typeof timestamp === "number" ? new Date(timestamp * 1000) : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function readStoredLetter(storage) {
  if (!storage) return null;
  try {
    return JSON.parse(storage.getItem(activeReplyKey) || "null");
  } catch {
    return null;
  }
}

function readActiveLetter() {
  return readStoredLetter(window.sessionStorage) || readStoredLetter(window.localStorage);
}

function readLetterReceipts() {
  try {
    const receipts = JSON.parse(window.localStorage.getItem(letterReceiptKey) || "[]");
    return Array.isArray(receipts) ? receipts : [];
  } catch {
    return [];
  }
}

function writeActiveLetter(letter) {
  try {
    window.sessionStorage.setItem(activeReplyKey, JSON.stringify(letter));
    window.localStorage.setItem(activeReplyKey, JSON.stringify(letter));
  } catch {
    // The letter can still be rendered for the current visit.
  }
}

export default function ReplyClient() {
  const [letter, setLetter] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadLetter() {
      const storedLetter = readActiveLetter();

      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      const receiptToken = params.get("token");
      const receipts =
        id && receiptToken ? [{ id, receiptToken }] : readLetterReceipts();

      if (!receipts.length) {
        setLetter(storedLetter);
        setLoading(false);
        return;
      }

      try {
        const response = await requestJson("/api/replies/lookup", {
          method: "POST",
          body: { receipts }
        });
        if (cancelled) return;
        const foundLetter = response.ok ? response.data.letters?.[0] : null;
        if (foundLetter?.reply) {
          const matchedReceipt = receipts.find(
            (receipt) => String(receipt.id) === String(foundLetter.id)
          );
          const nextLetter = { ...foundLetter, receiptToken };
          if (matchedReceipt?.receiptToken) {
            nextLetter.receiptToken = matchedReceipt.receiptToken;
          }
          writeActiveLetter(nextLetter);
          setLetter(nextLetter);
        } else {
          setLetter(storedLetter);
        }
      } catch {
        if (!cancelled) setLetter(storedLetter);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLetter();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="page-shell reply-shell" aria-labelledby="replyTitle">
      <section className="reply-page">
        <a className="soft-link panel-back" href="/">回到信箱</a>

        <article className="letter-paper" aria-live="polite">
          {letter?.reply ? (
            <>
              <header className="letter-paper-header">
                <div className="mascot small-mascot" aria-hidden="true">T o T</div>
                <h1 id="replyTitle">一封回信</h1>
              </header>

              <section className="letter-section">
                <h2>To Tyycc</h2>
                <p>{letter.content}</p>
              </section>

              <section className="letter-section">
                <h2>From Tyycc</h2>
                <p>{letter.reply}</p>
              </section>

              {(letter.replySupplements || []).map((supplement) => (
                <section className="letter-section" key={supplement.id}>
                  <h2>补充回信</h2>
                  <p>{supplement.content}</p>
                  <time>{formatLetterDate(supplement.createdAt)}</time>
                </section>
              ))}

              <time className="letter-date">
                {formatLetterDate(letter.replyUpdatedAt || letter.createdAt)}
              </time>
            </>
          ) : loading ? (
            <p className="letter-empty">正在找这封回信……</p>
          ) : (
            <p className="letter-empty">这封回信暂时没有找到。</p>
          )}
        </article>
      </section>
      <footer className="site-footer">ToT · To Tyycc</footer>
    </main>
  );
}
