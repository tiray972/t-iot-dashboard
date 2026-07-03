#include <M5Stack.h>
#include <M5LoRa.h>  // Lib LoRa intégrée dans M5Stack (SX1276)
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// === Configuration WiFi ===
// REMPLACE ces valeurs par ton WiFi local (ou le partage de connexion de ton téléphone)
const char* ssid     = "Galaxy A14 1074";
const char* password = "123456789";

// === Configuration API ===
// URL de ton endpoint API (remplace par ton API réelle ou une plateforme IoT)
const char* api_url  = "http://httpbin.org/post"; 

// === Pinout LoRa Module 868MHz pour M5Stack Core ===
#define LORA_CS   5    // Chip Select (NSS)
#define LORA_RST  36   // Reset
#define LORA_IRQ  26   // DIO0 (interrupt)

// === Fréquence LoRa EU 868 MHz ===
#define LORA_FREQUENCY  868E6

// === Machine d'état ===
enum DeviceMode {
    MODE_SELECT,
    MODE_EMITTER,
    MODE_RECEIVER
};

DeviceMode currentMode = MODE_SELECT;

// Variables pour l'Émetteur (Emitter)
bool isTransmitting = false;
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 2000; // Envoi automatique toutes les 2 secondes
int msgCount = 0;

// Variables pour le Récepteur (Receiver)
int receivedCount = 0;

// === Prototypes ===
void drawMainMenu();
void startEmitterMode();
void startReceiverMode();
void loopEmitter();
void loopReceiver();
void setupWiFi();
void sendDataToAPI(String payload, int rssi, float snr);
void setupLoRa();

// === Initialisation Générale ===
void setup() {
    M5.begin();
    Serial.begin(115200);
    M5.Lcd.setBrightness(120);
    
    // Initialise le module LoRa
    setupLoRa();

    // Affiche le menu de sélection au démarrage
    drawMainMenu();
}

// === Boucle Principale ===
void loop() {
    M5.update(); // Met à jour l'état des boutons du M5Stack

    // Gestion de la machine d'état
    switch (currentMode) {
        case MODE_SELECT:
            // Choix du mode au démarrage
            if (M5.BtnA.wasPressed()) {
                startEmitterMode();
            }
            if (M5.BtnB.wasPressed()) {
                startReceiverMode();
            }
            break;

        case MODE_EMITTER:
            loopEmitter();
            break;

        case MODE_RECEIVER:
            loopReceiver();
            break;
    }

    delay(10);
}

// === Dessin du Menu Principal ===
void drawMainMenu() {
    currentMode = MODE_SELECT;
    isTransmitting = false;

    M5.Lcd.fillScreen(BLACK);
    
    // Titre Premium
    M5.Lcd.fillRect(0, 0, 320, 45, BLUE);
    M5.Lcd.setTextColor(WHITE);
    M5.Lcd.setTextSize(2);
    M5.Lcd.setCursor(15, 12);
    M5.Lcd.println("M5 LORA GATEWAY");

    M5.Lcd.setTextSize(1);
    M5.Lcd.setTextColor(LIGHTGREY);
    M5.Lcd.setCursor(15, 60);
    M5.Lcd.println("Choisis le rôle de ce module :");

    // Option A
    M5.Lcd.fillRect(15, 90, 290, 45, DARKGREY);
    M5.Lcd.setTextColor(CYAN);
    M5.Lcd.setTextSize(2);
    M5.Lcd.setCursor(25, 103);
    M5.Lcd.println("A -> EMETTEUR (Node)");

    // Option B
    M5.Lcd.fillRect(15, 150, 290, 45, DARKGREY);
    M5.Lcd.setTextColor(ORANGE);
    M5.Lcd.setCursor(25, 163);
    M5.Lcd.println("B -> RECEPTEUR (API)");

    // Info en bas
    M5.Lcd.setTextSize(1);
    M5.Lcd.setTextColor(LIGHTGREY);
    M5.Lcd.setCursor(10, 220);
    M5.Lcd.println("Appuie sur le bouton A ou B sous l'ecran.");
}

// === Initialisation Mode Émetteur ===
void startEmitterMode() {
    currentMode = MODE_EMITTER;
    isTransmitting = false;
    
    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.fillRect(0, 0, 320, 45, MAGENTA);
    M5.Lcd.setTextColor(WHITE);
    M5.Lcd.setTextSize(2);
    M5.Lcd.setCursor(15, 12);
    M5.Lcd.println("MODE: EMETTEUR LORA");

    // Affichage des commandes
    M5.Lcd.setTextSize(1);
    M5.Lcd.setTextColor(WHITE);
    M5.Lcd.setCursor(15, 65);
    M5.Lcd.println("Btn A : Demarrer / Arreter l'envoi");
    M5.Lcd.setCursor(15, 85);
    M5.Lcd.println("Btn C : Retour Menu Principal");
    
    M5.Lcd.drawLine(0, 110, 320, 110, DARKGREY);
    
    // Status initial
    M5.Lcd.setTextColor(YELLOW);
    M5.Lcd.setTextSize(2);
    M5.Lcd.setCursor(15, 130);
    M5.Lcd.println("Statut: PAUSE");
}

// === Boucle Mode Émetteur ===
void loopEmitter() {
    // Bouton A : Basculer l'envoi continu ON/OFF
    if (M5.BtnA.wasPressed()) {
        isTransmitting = !isTransmitting;
        
        M5.Lcd.fillRect(0, 120, 320, 40, BLACK);
        M5.Lcd.setTextSize(2);
        M5.Lcd.setCursor(15, 130);
        
        if (isTransmitting) {
            M5.Lcd.setTextColor(GREEN);
            M5.Lcd.println("Statut: TRANSMISSION...");
            Serial.println("[Node] Envoi continu démarré !");
        } else {
            M5.Lcd.setTextColor(YELLOW);
            M5.Lcd.println("Statut: PAUSE");
            Serial.println("[Node] Envoi continu arrêté !");
        }
    }

    // Bouton C : Retour au menu principal
    if (M5.BtnC.wasPressed()) {
        drawMainMenu();
        return;
    }

    // Si on est en train de transmettre, on envoie régulièrement des données
    if (isTransmitting) {
        unsigned long currentMillis = millis();
        if (currentMillis - lastSendTime >= sendInterval) {
            lastSendTime = currentMillis;

            // Simulation de données capteurs
            float temp = 20.0 + random(-50, 50) / 10.0;
            float hum = 50.0 + random(-100, 100) / 10.0;
            int battery = M5.Power.getBatteryLevel();

            // Création du paquet de données
            String payload = "temp:" + String(temp, 1) + ";hum:" + String(hum, 1) + ";bat:" + String(battery) + ";id:" + String(msgCount++);

            // Envoi LoRa
            LoRa.beginPacket();
            LoRa.print(payload);
            LoRa.endPacket();

            // Affichage sur l'écran
            M5.Lcd.fillRect(0, 160, 320, 80, BLACK);
            M5.Lcd.setTextSize(1);
            M5.Lcd.setTextColor(LIGHTGREY);
            M5.Lcd.setCursor(15, 170);
            M5.Lcd.print("Envoi paquet #");
            M5.Lcd.println(msgCount);
            
            M5.Lcd.setTextSize(2);
            M5.Lcd.setTextColor(CYAN);
            M5.Lcd.setCursor(15, 195);
            M5.Lcd.println(payload);

            Serial.println("[LoRa TX] Envoye: " + payload);
        }
    }
}

// === Initialisation Mode Récepteur / Passerelle ===
void startReceiverMode() {
    currentMode = MODE_RECEIVER;
    receivedCount = 0;
    
    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.fillRect(0, 0, 320, 45, NAVY);
    M5.Lcd.setTextColor(WHITE);
    M5.Lcd.setTextSize(2);
    M5.Lcd.setCursor(15, 12);
    M5.Lcd.println("MODE: RECEPTEUR (GATEWAY)");

    M5.Lcd.setTextSize(1);
    M5.Lcd.setTextColor(LIGHTGREY);
    M5.Lcd.setCursor(15, 60);
    M5.Lcd.println("Btn C : Retour Menu Principal");
    M5.Lcd.drawLine(0, 75, 320, 75, DARKGREY);

    // Étape 1 : Connexion au WiFi
    setupWiFi();

    // Étape 2 : Lancer l'écoute
    M5.Lcd.fillRect(0, 140, 320, 100, BLACK);
    M5.Lcd.setTextSize(1);
    M5.Lcd.setTextColor(GREEN);
    M5.Lcd.setCursor(15, 145);
    M5.Lcd.println("Ecoute active sur 868 MHz...");
}

// === Boucle Mode Récepteur ===
void loopReceiver() {
    // Bouton C : Retour au menu principal
    if (M5.BtnC.wasPressed()) {
        drawMainMenu();
        return;
    }

    // Écoute non bloquante en continu
    int packetSize = LoRa.parsePacket();
    if (packetSize) {
        String received = "";
        while (LoRa.available()) {
            received += (char)LoRa.read();
        }

        int rssi = LoRa.packetRssi();
        float snr = LoRa.packetSnr();
        receivedCount++;

        // Affichage des infos du paquet sur l'écran
        M5.Lcd.fillRect(0, 140, 320, 100, BLACK);
        
        M5.Lcd.setTextSize(1);
        M5.Lcd.setTextColor(ORANGE);
        M5.Lcd.setCursor(15, 145);
        M5.Lcd.print("[Lora RX] Recu #");
        M5.Lcd.print(receivedCount);
        M5.Lcd.print(" (RSSI: ");
        M5.Lcd.print(rssi);
        M5.Lcd.println(" dBm)");

        M5.Lcd.setTextSize(2);
        M5.Lcd.setTextColor(WHITE);
        M5.Lcd.setCursor(15, 165);
        M5.Lcd.println(received);

        Serial.println("\n[Gateway RX] Recu: " + received);
        Serial.println("[Gateway RX] RSSI: " + String(rssi) + " dBm | SNR: " + String(snr) + " dB");

        // Envoi immédiat des données vers l'API
        sendDataToAPI(received, rssi, snr);
    }
}

// === Connexion WiFi ===
void setupWiFi() {
    Serial.println("\n[WiFi] Initialisation...");
    M5.Lcd.setTextColor(YELLOW);
    M5.Lcd.setTextSize(1);
    M5.Lcd.setCursor(15, 90);
    M5.Lcd.print("WiFi: Connexion a ");
    M5.Lcd.println(ssid);

    WiFi.begin(ssid, password);

    int timeout = 0;
    while (WiFi.status() != WL_CONNECTED && timeout < 30) {
        delay(500);
        Serial.print(".");
        M5.Lcd.print(".");
        timeout++;
    }

    M5.Lcd.fillRect(0, 85, 320, 50, BLACK);
    M5.Lcd.setCursor(15, 90);

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[WiFi] Connecte !");
        M5.Lcd.setTextColor(GREEN);
        M5.Lcd.println("WiFi CONNECTE !");
        M5.Lcd.setTextSize(1);
        M5.Lcd.setTextColor(WHITE);
        M5.Lcd.setCursor(15, 110);
        M5.Lcd.print("IP: ");
        M5.Lcd.println(WiFi.localIP().toString());
    } else {
        Serial.println("\n[WiFi] Echec (Timeout)");
        M5.Lcd.setTextColor(RED);
        M5.Lcd.println("WiFi ECHEC (Timeout)");
        M5.Lcd.setTextSize(1);
        M5.Lcd.setTextColor(DARKGREY);
        M5.Lcd.setCursor(15, 110);
        M5.Lcd.println("Mode hors ligne. Appuie sur C.");
    }
}

// === Envoi HTTP POST JSON vers l'API ===
void sendDataToAPI(String payload, int rssi, float snr) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[API] Impossible d'envoyer (Pas de WiFi)");
        M5.Lcd.setTextColor(RED);
        M5.Lcd.setTextSize(1);
        M5.Lcd.setCursor(15, 220);
        M5.Lcd.print("API: Erreur de WiFi !      ");
        return;
    }

    M5.Lcd.setTextColor(YELLOW);
    M5.Lcd.setTextSize(1);
    M5.Lcd.setCursor(15, 220);
    M5.Lcd.print("API: Envoi en cours...     ");

    HTTPClient http;
    http.begin(api_url);
    http.addHeader("Content-Type", "application/json");

    // Création du document JSON
    JsonDocument doc;
    doc["gateway_id"] = "M5Stack_Receiver_Gateway";
    doc["payload"] = payload;
    doc["rssi"] = rssi;
    doc["snr"] = snr;
    doc["uptime_ms"] = millis();

    String jsonString;
    serializeJson(doc, jsonString);

    Serial.println("[API POST] " + jsonString);
    int httpResponseCode = http.POST(jsonString);

    M5.Lcd.fillRect(0, 215, 320, 25, BLACK);
    M5.Lcd.setCursor(15, 220);

    if (httpResponseCode > 0) {
        Serial.println("[API POST] Success, Code: " + String(httpResponseCode));
        M5.Lcd.setTextColor(GREEN);
        M5.Lcd.print("API: OK (Code " + String(httpResponseCode) + ")     ");
    } else {
        Serial.println("[API POST] Error: " + String(httpResponseCode));
        M5.Lcd.setTextColor(RED);
        M5.Lcd.print("API: Erreur (" + String(httpResponseCode) + ")     ");
    }
    http.end();
}

// === Configuration LoRa ===
void setupLoRa() {
    LoRa.setPins(LORA_CS, LORA_RST, LORA_IRQ);

    if (!LoRa.begin(LORA_FREQUENCY)) {
        Serial.println("[LoRa] Echec initialisation !");
        M5.Lcd.fillScreen(BLACK);
        M5.Lcd.setTextColor(RED);
        M5.Lcd.setTextSize(3);
        M5.Lcd.setCursor(10, 100);
        M5.Lcd.println("LoRa ERREUR");
        while (1);
    }

    LoRa.setSpreadingFactor(7);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setCodingRate4(5);
    LoRa.setTxPower(17);

    Serial.println("[LoRa] Initialise sur 868 MHz");
}
