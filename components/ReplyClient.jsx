"use client";

import { useEffect, useState } from "react";

const activeReplyKey = "totActiveReplyLetter";

function formatLetterDate(timestamp) {
  const date =
    typeof timestamp === "number" ? new Date(timestamp * 1000) : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function readActiveLetter() {
  try {
    return JSON.parse(window.sessionStorage.getItem(activeReplyKey) || "null");
  } catch {
    return null;
  }
}

export default function ReplyClient() {
  const [letter, setLetter] = useState(null);

  useEffect(() => {
    setLetter(readActiveLetter());
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

              <time className="letter-date">
                {formatLetterDate(letter.replyUpdatedAt || letter.createdAt)}
              </time>
            </>
          ) : (
            <p className="letter-empty">这封回信暂时没有找到。</p>
          )}
        </article>
      </section>
      <footer className="site-footer">ToT · To Tyycc</footer>
    </main>
  );
}
