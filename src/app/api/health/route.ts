import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "muna-shop",
    timestamp: Date.now(),
  });
}
