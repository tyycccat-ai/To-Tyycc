import { NextResponse } from "next/server";
import { likePublicMessage } from "../../../../../../lib/messages";

export async function POST(_request, { params }) {
  try {
    const likes = await likePublicMessage(params.id);
    if (likes === null) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, likes });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "like_failed" }, { status: 500 });
  }
}
