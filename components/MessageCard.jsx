import HeartIcon from "./HeartIcon";

export function formatTime(timestamp, options = { dateStyle: "medium" }) {
  const date =
    typeof timestamp === "number" ? new Date(timestamp * 1000) : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", options).format(date);
}

export function formatIsoDate(timestamp) {
  const date =
    typeof timestamp === "number" ? new Date(timestamp * 1000) : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return String(timestamp || "");
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function PublicMessageCard({ message, liked, onLike }) {
  return (
    <article className="message-card public-card">
      <div className="message-meta">
        <span>{message.displayName}</span>
        <time>{formatTime(message.createdAt)}</time>
      </div>
      <p>{message.content}</p>
      {message.reply ? (
        <div className="reply-block">
          <span>回信</span>
          <p>{message.reply}</p>
        </div>
      ) : null}
      <div className="public-actions">
        <button
          type="button"
          className={`like-button${liked ? " liked" : ""}`}
          disabled={liked}
          onClick={() => onLike(message.id)}
          aria-label="喜欢"
        >
          <HeartIcon />
          <span className="like-count">{message.likes || 0}</span>
        </button>
      </div>
    </article>
  );
}
