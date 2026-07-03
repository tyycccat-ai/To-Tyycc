import { NextResponse } from "next/server";
import { listPublicMessages } from "../../../../lib/messages";

export async function GET() {
  try {
    const messages = await listPublicMessages();
    return NextResponse.json({ ok: true, messages });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "public_messages_unavailable" },
      { status: 500 }
    );
  }
}
