import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export function getAdminFirestore() {
  const serviceAccount = readServiceAccount();

  if (!serviceAccount) {
    return null;
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount)
    });
  }

  return getFirestore();
}

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!raw) {
    return null;
  }

  try {
    const json = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(json) as ServiceAccount;

    if (parsed.privateKey) {
      parsed.privateKey = parsed.privateKey.replace(/\\n/g, "\n");
    }

    return parsed;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY est invalide");
  }
}
