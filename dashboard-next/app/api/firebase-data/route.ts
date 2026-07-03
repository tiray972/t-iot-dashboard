import { NextResponse } from "next/server";
import { loadDashboardData } from "@/lib/firebase-data";

export async function GET() {
  try {
    const data = await loadDashboardData();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Firebase error";

    return NextResponse.json(
      {
        error: message,
        generatedAt: new Date().toISOString(),
        items: []
      },
      { status: 500 }
    );
  }
}
