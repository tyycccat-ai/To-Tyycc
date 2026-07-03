const form = document.querySelector("#messageForm");
const textarea = document.querySelector("#message");
const mascot = document.querySelector("#mascot");
const sendButton = document.querySelector(".send-button");
const formNote = document.querySelector("#formNote");
const deliveryCard = document.querySelector("#deliveryCard");
const replyNotice = document.querySelector("#replyNotice");
const readReplyButton = document.querySelector("#readReplyButton");
const likedMessages = new Set(readLikedMessages());

let receiveTimer;
let deliveryTimer;
let activeReplyLetter;
const letterReceiptKey = "totLetterReceipts";
const activeReplyKey = "totActiveReplyLetter";

function markSocialWebview() {
  const ua = navigator.userAgent || "";
  if (/MicroMessenger|QQ\/|MQQBrowser/i.test(ua)) {
    document.documentElement.classList.add("social-webview");
  }
}

function heartMarkup() {
  return `
    <span class="heart-icon" aria-hidden="true">
      <span class="heart-text">♥</span>
      <svg class="heart-svg" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M12 21.2C9.1 18.7 6.7 16.5 4.9 14.5C3.1 12.5 2.2 10.5 2.2 8.6C2.2 6.2 3.9 4.5 6.2 4.5C7.6 4.5 8.9 5.2 9.7 6.3L12 9.1L14.3 6.3C15.1 5.2 16.4 4.5 17.8 4.5C20.1 4.5 21.8 6.2 21.8 8.6C21.8 10.5 20.9 12.5 19.1 14.5C17.3 16.5 14.9 18.7 12 21.2Z" />
      </svg>
    </span>
  `;
}

markSocialWebview();

function readLikedMessages() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem("totLikedMessages") || "[]");
  } catch (error) {
    return [];
  }
}

function saveLikedMessages() {
  try {
    globalThis.localStorage?.setItem(
      "totLikedMessages",
      JSON.stringify([...likedMessages]),
    );
  } catch (error) {
    // Liking still works even if the browser blocks local storage.
  }
}

function readLetterReceipts() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(letterReceiptKey) || "[]");
  } catch (error) {
    return [];
  }
}

function saveLetterReceipts(receipts) {
  try {
    globalThis.localStorage?.setItem(letterReceiptKey, JSON.stringify(receipts));
  } catch (error) {
    // The letter can still be delivered if this browser cannot store the receipt.
  }
}

function rememberLetter(letter) {
  if (!letter?.id || !letter?.receiptToken) return;
  const receipts = readLetterReceipts().filter(
    (receipt) => String(receipt.id) !== String(letter.id),
  );
  receipts.unshift({
    id: letter.id,
    receiptToken: letter.receiptToken,
    seenReplyUpdatedAt: "",
  });
  saveLetterReceipts(receipts.slice(0, 30));
}

function markReplyAsRead(letter) {
  const updatedAt = String(letter.replyUpdatedAt || letter.id);
  const receipts = readLetterReceipts().map((receipt) =>
    String(receipt.id) === String(letter.id)
      ? { ...receipt, seenReplyUpdatedAt: updatedAt }
      : receipt,
  );
  saveLetterReceipts(receipts);
}

async function requestJson(url, options = {}) {
  const method = options.method || "GET";
  const payload = options.body;

  if (typeof fetch === "function") {
    const response = await fetch(url, {
      method,
      headers: payload
        ? {
            "Content-Type": "application/json",
          }
        : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    let data = {};
    try {
      data = await response.json();
    } catch (error) {
      data = {};
    }
    return { ok: response.ok, status: response.status, data };
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    if (payload) {
      xhr.setRequestHeader("Content-Type", "application/json");
    }
    xhr.onload = () => {
      let data = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch (error) {
        data = {};
      }
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        data,
      });
    };
    xhr.onerror = () => reject(new Error("Request failed"));
    xhr.send(payload ? JSON.stringify(payload) : null);
  });
}

function formatTime(timestamp) {
  const date =
    typeof timestamp === "number" ? new Date(timestamp * 1000) : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
  }).format(date);
}

function escapeText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setMascot(state) {
  mascot.classList.remove("listening", "received");

  if (state === "listening") {
    mascot.textContent = "> o <";
    mascot.classList.add("listening");
    mascot.setAttribute("aria-label", "匿名信正在认真听");
    return;
  }

  if (state === "received") {
    mascot.textContent = "T ◡ T";
    mascot.classList.add("received");
    mascot.setAttribute("aria-label", "匿名信收到啦");
    return;
  }

  mascot.textContent = "T o T";
  mascot.setAttribute("aria-label", "T o T 正在等待");
}

textarea.addEventListener("input", () => {
  window.clearTimeout(receiveTimer);
  document.body.classList.remove("sent");

  if (textarea.value.trim()) {
    setMascot("listening");
  } else {
    setMascot("waiting");
  }
});

function setNote(message) {
  formNote.textContent = message;
  formNote.classList.toggle("show", Boolean(message));
}

function showDeliveryCard() {
  window.clearTimeout(deliveryTimer);
  deliveryCard.classList.remove("hidden", "leaving");
  deliveryCard.classList.add("show");

  deliveryTimer = window.setTimeout(() => {
    deliveryCard.classList.add("leaving");
    deliveryCard.classList.remove("show");
    window.setTimeout(() => {
      deliveryCard.classList.add("hidden");
      deliveryCard.classList.remove("leaving");
    }, 360);
  }, 2000);
}

function homePublicContainer() {
  return document.querySelector("#homePublicMessages");
}

function renderHomePublicMessages(messages) {
  const container = homePublicContainer();
  if (!container) return;

  const visibleMessages = messages.slice(0, 3);

  if (!visibleMessages.length) {
    container.innerHTML = `<p class="empty-state">这里还没有被公开的信。</p>`;
    return;
  }

  container.innerHTML = visibleMessages
    .map((message) => {
      const liked = likedMessages.has(String(message.id));
      return `
        <article class="message-card public-card">
          <div class="message-meta">
            <span>${escapeText(message.displayName)}</span>
            <time>${formatTime(message.createdAt)}</time>
          </div>
          <p>${escapeText(message.content)}</p>
          ${
            message.reply
              ? `<div class="reply-block">
                   <span>回信</span>
                   <p>${escapeText(message.reply)}</p>
                 </div>`
              : ""
          }
          <div class="public-actions">
            <button
              type="button"
              class="like-button${liked ? " liked" : ""}"
              data-id="${message.id}"
              ${liked ? "disabled" : ""}
            >
              ${heartMarkup()}
              <span class="like-count">${message.likes || 0}</span>
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function likeMessage(button) {
  if (!button || likedMessages.has(String(button.dataset.id))) return;

  button.disabled = true;
  try {
    const response = await requestJson(
      `/api/public/messages/${encodeURIComponent(button.dataset.id)}/like`,
      { method: "POST" },
    );
    if (!response.ok) throw new Error("Like failed");
    likedMessages.add(String(button.dataset.id));
    saveLikedMessages();
    button.classList.add("liked");
    button.querySelector(".like-count").textContent = response.data.likes;
  } catch (error) {
    button.disabled = false;
  }
}

async function loadHomePublicMessages() {
  const container = homePublicContainer();
  if (!container) return;

  try {
    const response = await requestJson("/api/public/messages");
    if (!response.ok) throw new Error("Failed to load public messages");
    renderHomePublicMessages(response.data.messages);
  } catch (error) {
    if (!container.querySelector(".message-card")) {
      container.innerHTML = `<p class="empty-state">公开信暂时没有打开。</p>`;
    }
  }
}

function initHomePublicMessages() {
  const container = homePublicContainer();
  if (!container || container.dataset.ready === "true") return;
  container.dataset.ready = "true";
  container.addEventListener("click", (event) => {
    likeMessage(event.target.closest("button[data-id]"));
  });
  if (globalThis.__TOT_PUBLIC_MESSAGES__?.messages) {
    renderHomePublicMessages(globalThis.__TOT_PUBLIC_MESSAGES__.messages);
  }
  loadHomePublicMessages();
}

initHomePublicMessages();
window.addEventListener("DOMContentLoaded", initHomePublicMessages);
window.addEventListener("pageshow", loadHomePublicMessages);

function showReplyNotice(letter) {
  activeReplyLetter = letter;
  replyNotice.classList.remove("hidden");
  replyNotice.classList.add("show");
}

async function checkReplyLetters() {
  const receipts = readLetterReceipts();
  if (!receipts.length) return;

  try {
    const response = await requestJson("/api/replies/lookup", {
      method: "POST",
      body: {
        receipts,
      },
    });
    if (!response.ok) return;
    const letters = response.data.letters || [];
    const newLetter = letters.find((letter) => {
      const receipt = receipts.find((item) => String(item.id) === String(letter.id));
      return (
        receipt &&
        String(receipt.seenReplyUpdatedAt || "") !==
          String(letter.replyUpdatedAt || letter.id)
      );
    });
    if (newLetter) {
      showReplyNotice(newLetter);
    }
  } catch (error) {
    // No hint is shown when the reply box cannot be checked.
  }
}

readReplyButton.addEventListener("click", () => {
  if (!activeReplyLetter) return;
  try {
    globalThis.sessionStorage?.setItem(
      activeReplyKey,
      JSON.stringify(activeReplyLetter),
    );
  } catch (error) {
    // The reply page will show a quiet empty state if the browser blocks storage.
  }
  markReplyAsRead(activeReplyLetter);
  window.location.href = "/reply";
});

checkReplyLetters();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  window.clearTimeout(receiveTimer);
  setNote("");

  if (!textarea.value.trim()) {
    textarea.focus();
    setMascot("listening");
    return;
  }

  sendButton.disabled = true;

  try {
    const formData = new FormData(form);
    const response = await requestJson("/api/messages", {
      method: "POST",
      body: {
        content: String(formData.get("message") || ""),
        nickname: String(formData.get("nickname") || ""),
        allowPublic: formData.get("allowPublic") === "on",
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        setNote("先让信箱喘口气，一分钟后再试试");
      } else if (response.status === 400) {
        setNote("这封信里好像有暂时不能投递的内容");
      }
      throw new Error("Message delivery failed");
    }
    rememberLetter(response.data.letter);
  } catch (error) {
    sendButton.disabled = false;
    if (!formNote.textContent) {
      setNote("这封信暂时没有投递出去");
    }
    setMascot("listening");
    return;
  }

  setMascot("received");
  showDeliveryCard();
  document.body.classList.add("sent");

  sendButton.classList.remove("is-sending");
  void sendButton.offsetWidth;
  sendButton.classList.add("is-sending");

  receiveTimer = window.setTimeout(() => {
    form.reset();
    setMascot("waiting");
    document.body.classList.remove("sent");
    sendButton.classList.remove("is-sending");
    sendButton.disabled = false;
    setNote("");
    loadHomePublicMessages();
  }, 2200);
});
