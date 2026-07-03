import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/auth";
import { listAdminMessages } from "../../../../lib/messages";

export async function GET(request) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const messages = await listAdminMessages();
    return NextResponse.json({ ok: true, messages });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "admin_messages_unavailable" },
      { status: 500 }
    );
  }
}
