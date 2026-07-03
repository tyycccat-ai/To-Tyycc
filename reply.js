const replyLetter = document.querySelector("#replyLetter");
const activeReplyKey = "totActiveReplyLetter";

function escapeText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

function readActiveLetter() {
  try {
    return JSON.parse(globalThis.sessionStorage?.getItem(activeReplyKey) || "null");
  } catch (error) {
    return null;
  }
}

function renderLetter(letter) {
  if (!letter?.reply) {
    replyLetter.innerHTML = `<p class="letter-empty">这封回信暂时没有找到。</p>`;
    return;
  }

  replyLetter.innerHTML = `
    <header class="letter-paper-header">
      <div class="mascot small-mascot" aria-hidden="true">T o T</div>
      <h1 id="replyTitle">一封回信</h1>
    </header>

    <section class="letter-section">
      <h2>To Tyycc</h2>
      <p>${escapeText(letter.content)}</p>
    </section>

    <section class="letter-section">
      <h2>From Tyycc</h2>
      <p>${escapeText(letter.reply)}</p>
    </section>

    <time class="letter-date">${formatLetterDate(
      letter.replyUpdatedAt || letter.createdAt,
    )}</time>
  `;
}

renderLetter(readActiveLetter());
