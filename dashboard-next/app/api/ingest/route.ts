import { NextResponse } from "next/server";
import { saveDashboardReading } from "@/lib/firebase-data";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const reading = await saveDashboardReading(body);

    return NextResponse.json({
      ok: true,
      reading
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to ingest reading";

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 500 }
    );
  }
}
