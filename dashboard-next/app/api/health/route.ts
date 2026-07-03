import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    firebase: {
      firestoreProjectId: Boolean(process.env.FIREBASE_FIRESTORE_PROJECT_ID),
      firestoreCollection: process.env.FIREBASE_FIRESTORE_COLLECTION || "lora-readings",
      serviceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY),
      realtimeDatabase: Boolean(process.env.FIREBASE_RTDB_URL)
    },
    dashboard: {
      refreshMs: Number(process.env.NEXT_PUBLIC_DASHBOARD_REFRESH_MS || 3000)
    }
  });
}
