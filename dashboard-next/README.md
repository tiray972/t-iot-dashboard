# T-IOT-77 Dashboard Next

Dashboard Next.js pour visualiser l'evolution des donnees LoRa stockees dans Firebase.

## Lancer

```bash
cd dashboard-next
npm install
npm run dev
```

Puis ouvrir `http://localhost:3000`.

Sans configuration Firebase, le dashboard affiche des donnees demo pour verifier les graphiques.

## Brancher Firebase

Copie `.env.example` vers `.env.local`, puis remplis une des deux sources.

### Realtime Database

```bash
FIREBASE_RTDB_URL=https://ton-projet-default-rtdb.europe-west1.firebasedatabase.app
FIREBASE_RTDB_PATH=lora-readings
FIREBASE_ID_TOKEN=
FIREBASE_DATABASE_SECRET=
```

### Firestore

```bash
FIREBASE_FIRESTORE_PROJECT_ID=ton-projet
FIREBASE_FIRESTORE_COLLECTION=lora-readings
FIREBASE_BEARER_TOKEN=
FIREBASE_API_KEY=
```

## Format attendu

La route `/api/firebase-data` accepte les donnees sous forme de documents/objets comme:

```json
{
  "gateway_id": "M5Stack_Receiver_Gateway",
  "payload": "temp:24.1;hum:55.2;bat:92;id:12",
  "rssi": -78,
  "snr": 7.5,
  "uptime_ms": 120000,
  "timestamp": "2026-07-03T12:00:00.000Z"
}
```

Les champs `temperature`, `humidity`, `battery`, `temp`, `hum`, ou `bat` sont aussi lus directement si tu les stockes deja dans Firebase.
