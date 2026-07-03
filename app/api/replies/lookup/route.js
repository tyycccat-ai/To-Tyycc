import { NextResponse } from "next/server";
import { lookupReplyLetters } from "../../../../lib/messages";

export async function POST(request) {
  try {
    const data = await request.json();
    const receipts = data.receipts;
    if (!Array.isArray(receipts)) {
      return NextResponse.json(
        { ok: false, error: "bad_receipts" },
        { status: 400 }
      );
    }
    const letters = await lookupReplyLetters(receipts);
    return NextResponse.json({ ok: true, letters });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "reply_lookup_failed" },
      { status: 500 }
    );
  }
}
