const loginForm = document.querySelector("#adminLogin");
const adminBoard = document.querySelector("#adminBoard");
const adminMessages = document.querySelector("#adminMessages");
const adminNote = document.querySelector("#adminNote");
const messageCount = document.querySelector("#messageCount");
const logoutButton = document.querySelector("#logoutButton");

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

function setAdminNote(message) {
  adminNote.textContent = message;
  adminNote.classList.toggle("show", Boolean(message));
}

function formatTime(timestamp) {
  const date =
    typeof timestamp === "number" ? new Date(timestamp * 1000) : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function escapeText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderMessages(messages) {
  messageCount.textContent = `${messages.length} 封信`;

  if (!messages.length) {
    adminMessages.innerHTML = `<p class="empty-state">还没有新的信。</p>`;
    return;
  }

  adminMessages.innerHTML = messages
    .map((message) => {
      const canPublish = message.allowPublic;
      const nickname = message.nickname?.trim() || "匿名";
      const hasReply = Boolean(message.reply?.trim());
      const publishButton = message.isPublic
        ? `<button
             type="button"
             class="text-button publish-button unpublish-button"
             data-action="toggle"
             data-id="${message.id}"
             data-public="false"
           >
             取消公开
           </button>`
        : canPublish
          ? `<button
               type="button"
               class="text-button publish-button"
               data-action="toggle"
               data-id="${message.id}"
               data-public="true"
             >
               公开
             </button>`
          : "";
      return `
        <article class="message-card">
          <div class="message-meta">
            <span>${escapeText(nickname)}</span>
            <time>${formatTime(message.createdAt)}</time>
          </div>
          <p>${escapeText(message.content)}</p>
          <div class="message-flags">
            <span>${canPublish ? "允许公开：是" : "允许公开：否"}</span>
            <span>${message.isPublic ? "已公开：是" : "已公开：否"}</span>
            <span>${message.likes || 0} 个喜欢</span>
          </div>
          <label class="reply-editor">
            <span>回信</span>
            <textarea
              data-reply-id="${message.id}"
              data-original-reply="${escapeText(message.reply || "")}"
              maxlength="3000"
              rows="3"
              placeholder="写一封只属于这条留言的回信"
            >${escapeText(message.reply || "")}</textarea>
          </label>
          <div class="reply-actions">
            <button
              type="button"
              class="text-button reply-confirm-button${hasReply ? " is-confirmed" : ""}"
              data-action="reply"
              data-id="${message.id}"
              ${hasReply ? "disabled" : ""}
            >
              ${hasReply ? "已回信" : "确认回信"}
            </button>
          </div>
          <div class="message-actions">
            <button
              type="button"
              class="text-button danger-button"
              data-action="delete"
              data-id="${message.id}"
            >
              删除
            </button>
            ${publishButton}
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadMessages() {
  const response = await requestJson("/api/admin/messages");
  if (response.status === 401) {
    loginForm.classList.remove("hidden");
    adminBoard.classList.add("hidden");
    return;
  }
  if (!response.ok) {
    setAdminNote("信箱暂时打不开");
    return;
  }
  loginForm.classList.add("hidden");
  adminBoard.classList.remove("hidden");
  setAdminNote("");
  renderMessages(response.data.messages);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAdminNote("");

  const formData = new FormData(loginForm);
  const response = await requestJson("/api/admin/login", {
    method: "POST",
    body: {
      password: String(formData.get("password") || ""),
    },
  });

  if (!response.ok) {
    setAdminNote("密码好像不对");
    return;
  }

  loginForm.reset();
  await loadMessages();
});

adminMessages.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action][data-id]");
  if (!button) return;

  button.disabled = true;
  const shouldDelete = button.dataset.action === "delete";
  const shouldReply = button.dataset.action === "reply";
  const messageUrl = `/api/admin/messages/${encodeURIComponent(button.dataset.id)}`;
  const response = shouldDelete
    ? await requestJson(messageUrl, {
        method: "DELETE",
      })
    : shouldReply
      ? await requestJson(messageUrl, {
          method: "PATCH",
          body: {
            reply: document.querySelector(
              `textarea[data-reply-id="${CSS.escape(button.dataset.id)}"]`,
            ).value,
          },
        })
    : await requestJson(messageUrl, {
        method: "PATCH",
        body: {
          isPublic: button.dataset.public === "true",
        },
      });

  if (!response.ok) {
    setAdminNote(
      shouldDelete
        ? "这封信暂时删不掉"
        : shouldReply
          ? "这封回信暂时确认不了"
          : "这封信暂时改不了公开状态",
    );
    await loadMessages();
    return;
  }

  await loadMessages();
});

adminMessages.addEventListener("input", (event) => {
  const textarea = event.target.closest("textarea[data-reply-id]");
  if (!textarea) return;

  const button = adminMessages.querySelector(
    `button[data-action="reply"][data-id="${CSS.escape(textarea.dataset.replyId)}"]`,
  );
  if (!button) return;

  const original = textarea.dataset.originalReply || "";
  const changed = textarea.value.trim() !== original.trim();

  if (changed) {
    button.disabled = false;
    button.textContent = "确认回信";
    button.classList.remove("is-confirmed");
    return;
  }

  if (original.trim()) {
    button.disabled = true;
    button.textContent = "已回信";
    button.classList.add("is-confirmed");
  }
});

logoutButton.addEventListener("click", async () => {
  await requestJson("/api/admin/logout", { method: "POST" });
  adminBoard.classList.add("hidden");
  loginForm.classList.remove("hidden");
});

loadMessages();
