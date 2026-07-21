import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/auth";
import { stickyPasswordDurationHours } from "../../../../lib/stickyAuth";
import { generateAndSaveStickyPassword } from "../../../../lib/stickyNotes";

export const runtime = "nodejs";

export async function PATCH(request) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const data = await request.json();
    const durationHours = stickyPasswordDurationHours(data.durationHours);
    const customPassword = String(data.password || "").trim().slice(0, 64);

    const setting = await generateAndSaveStickyPassword(durationHours, customPassword);
    return NextResponse.json({
      ok: true,
      passwordSet: true,
      currentPassword: setting.plainPassword,
      expiresAt: setting.expiresAt,
      durationHours: setting.durationHours
    });
  } catch {
    return NextResponse.json({ ok: false, error: "sticky_password_update_failed" }, { status: 500 });
  }
}
