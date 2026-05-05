import { NextResponse } from "next/server";
import { isNewToolTabEnabled } from "@/lib/newToolFeature";

export const dynamic = "force-dynamic";

/**
 * Placeholder for the “new tool” tab. Hidden in production until
 * NEXT_PUBLIC_SHOW_NEW_TOOL_TAB is set.
 */
export async function GET() {
  if (!isNewToolTabEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    status: "placeholder",
    message: "New tool API — not implemented yet.",
  });
}
