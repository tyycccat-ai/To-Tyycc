import { NextResponse } from "next/server";
import { likePublicMessage } from "../../../../../../lib/messages";

export const runtime = "nodejs";

export async function POST(_request, { params }) {
  try {
    const { id } = await params;
    const likes = await likePublicMessage(id);
    if (likes === null) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, likes });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "like_failed" }, { status: 500 });
  }
}
