const publicMessages = document.querySelector("#publicMessages");
const publicSearch = document.querySelector("#publicSearch");
const likedMessages = new Set(readLikedMessages());
let allPublicMessages = [];

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

function formatIsoDate(timestamp) {
  const date =
    typeof timestamp === "number" ? new Date(timestamp * 1000) : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return String(timestamp || "");
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderPublicMessages(messages, emptyText = "这里还没有被公开的信。") {
  if (!messages.length) {
    publicMessages.innerHTML = `<p class="empty-state">${emptyText}</p>`;
    return;
  }

  publicMessages.innerHTML = messages
    .map(
      (message) => {
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
      },
    )
    .join("");
}

function messageSearchText(message) {
  return [
    message.displayName,
    message.content,
    message.reply,
    formatTime(message.createdAt),
    formatIsoDate(message.createdAt),
  ]
    .join(" ")
    .toLowerCase();
}

function applyPublicSearch() {
  const query = publicSearch.value.trim().toLowerCase();
  if (!query) {
    renderPublicMessages(allPublicMessages);
    return;
  }

  const filtered = allPublicMessages.filter((message) =>
    messageSearchText(message).includes(query),
  );
  renderPublicMessages(filtered, "没有找到对应的信。");
}

publicMessages.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-id]");
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
    allPublicMessages = allPublicMessages.map((message) =>
      String(message.id) === String(button.dataset.id)
        ? { ...message, likes: response.data.likes }
        : message,
    );
  } catch (error) {
    button.disabled = false;
  }
});

async function loadPublicMessages() {
  try {
    const response = await requestJson("/api/public/messages");
    if (!response.ok) throw new Error("Failed to load public messages");
    allPublicMessages = response.data.messages || [];
    applyPublicSearch();
  } catch (error) {
    if (!publicMessages.querySelector(".message-card")) {
      publicMessages.innerHTML = `<p class="empty-state">公开信暂时没有打开。</p>`;
    }
  }
}

if (globalThis.__TOT_PUBLIC_MESSAGES__?.messages) {
  allPublicMessages = globalThis.__TOT_PUBLIC_MESSAGES__.messages;
  applyPublicSearch();
}
publicSearch.addEventListener("input", applyPublicSearch);
loadPublicMessages();
