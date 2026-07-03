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

## Ingestion depuis le M5Stack

La route `POST /api/ingest` accepte aussi le format Sensor.Community utilise par `T-IOT-902-NCE_1/LORA_CodeM5`:

```json
{
  "gateway_id": "M5Stack_Receiver_Gateway",
  "device_id": "12",
  "payload": "id=12; temp=23.4; hum=54.1; hic=24.0; air=512.0; qualite=Bonne",
  "rssi": -78,
  "snr": 7.5,
  "sensordatavalues": [
    { "value_type": "temperature", "value": 23.4 },
    { "value_type": "humidity", "value": 54.1 },
    { "value_type": "P1", "value": 512 }
  ]
}
```

Le firmware peut donc continuer a envoyer vers Sensor.Community et poster en plus vers:

```text
https://ton-deploiement-vercel.vercel.app/api/ingest
```

Pour stocker les donnees, configure soit Realtime Database (`FIREBASE_RTDB_URL`), soit Firestore (`FIREBASE_FIRESTORE_PROJECT_ID`). Si Firestore retourne `SERVICE_DISABLED`, active Cloud Firestore dans la console Google ou utilise Realtime Database.
