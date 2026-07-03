import { NextResponse } from "next/server";
import {
  MAX_CONTENT_LENGTH,
  MAX_NICKNAME_LENGTH,
  contentBlocked,
  createMessage
} from "../../../lib/messages";
import { clientIp, rateLimited } from "../../../lib/rateLimit";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const data = await request.json();
    const content = String(data.content || "").trim();
    const nickname = String(data.nickname || "").trim();
    const allowPublic = Boolean(data.allowPublic);

    if (!content) {
      return NextResponse.json(
        { ok: false, error: "content_required" },
        { status: 400 }
      );
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ ok: false, error: "too_long" }, { status: 400 });
    }
    if (nickname.length > MAX_NICKNAME_LENGTH) {
      return NextResponse.json(
        { ok: false, error: "nickname_too_long" },
        { status: 400 }
      );
    }
    if (contentBlocked(content, nickname)) {
      return NextResponse.json(
        { ok: false, error: "blocked_content" },
        { status: 400 }
      );
    }
    if (rateLimited(clientIp(request))) {
      return NextResponse.json(
        { ok: false, error: "rate_limited" },
        { status: 429 }
      );
    }

    const letter = await createMessage({ content, nickname, allowPublic });
    return NextResponse.json({ ok: true, letter }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "delivery_failed" },
      { status: 500 }
    );
  }
}
