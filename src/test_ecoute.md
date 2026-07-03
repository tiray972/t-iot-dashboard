# code pour loRa test ecoute entre deux M5

```
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
// Le module LoRa se connecte au slot inférieur du M5Stack
#define LORA_CS   5    // Chip Select (NSS)
#define LORA_RST  36   // Reset
#define LORA_IRQ  26   // DIO0 (interrupt)

// === Fréquence LoRa EU 868 MHz ===
#define LORA_FREQUENCY  868E6

// === Compteur de messages ===
int msgCount = 0;

// === Fonctions WiFi & API ===
void setupWiFi() {
    Serial.println("\n[WiFi] Connexion en cours...");
    M5.Lcd.fillRect(0, 100, 320, 140, BLACK);
    M5.Lcd.setTextColor(YELLOW);
    M5.Lcd.setTextSize(1);
    M5.Lcd.setCursor(10, 105);
    M5.Lcd.print("WiFi: Connexion a ");
    M5.Lcd.println(ssid);

    WiFi.begin(ssid, password);

    int timeout = 0;
    // Tente de se connecter pendant maximum 15 secondes (30 * 500ms)
    while (WiFi.status() != WL_CONNECTED && timeout < 30) {
        delay(500);
        Serial.print(".");
        M5.Lcd.print(".");
        timeout++;
    }

    M5.Lcd.fillRect(0, 100, 320, 140, BLACK);
    M5.Lcd.setCursor(10, 105);

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[WiFi] Connecte avec succes !");
        Serial.print("[WiFi] Adresse IP : ");
        Serial.println(WiFi.localIP());

        M5.Lcd.setTextColor(GREEN);
        M5.Lcd.println("WiFi CONNECTE !");
        M5.Lcd.setTextSize(1);
        M5.Lcd.setTextColor(WHITE);
        M5.Lcd.print("IP: ");
        M5.Lcd.println(WiFi.localIP().toString());
    } else {
        Serial.println("\n[WiFi] Impossible de se connecter (Timeout)");
        M5.Lcd.setTextColor(RED);
        M5.Lcd.println("WiFi ECHEC (Timeout)");
        M5.Lcd.setTextSize(1);
        M5.Lcd.setTextColor(DARKGREY);
        M5.Lcd.println("Verifie le SSID/Mot de passe");
    }
    delay(2000);
}

void sendDataToAPI(String payload, int rssi = 0, float snr = 0.0) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[API] Erreur : Non connecte au WiFi");
        return;
    }

    Serial.println("[API] Envoi des donnees...");
    HTTPClient http;
    
    // Initialise l'URL de l'API
    http.begin(api_url);
    http.addHeader("Content-Type", "application/json");

    // Construction du document JSON
    JsonDocument doc;
    doc["device"] = "M5Stack_Core";
    doc["payload"] = payload;
    doc["rssi"] = rssi;
    doc["snr"] = snr;
    doc["uptime_ms"] = millis();

    // Ajout de donnees de batterie
    doc["sensors"]["battery_percent"] = M5.Power.getBatteryLevel();
    doc["sensors"]["is_charging"] = M5.Power.isCharging();

    String jsonString;
    serializeJson(doc, jsonString);

    Serial.println("[API] POST Payload: " + jsonString);

    // Envoi de la requete POST
    int httpResponseCode = http.POST(jsonString);

    if (httpResponseCode > 0) {
        String response = http.getString();
        Serial.print("[API] Code HTTP de retour : ");
        Serial.println(httpResponseCode);
        Serial.println("[API] Reponse du serveur : " + response);
    } else {
        Serial.print("[API] Erreur lors de l'envoi HTTP POST : ");
        Serial.println(httpResponseCode);
    }
    
    http.end();
}


void setupLoRa() {
    // Le module LoRa utilise le SPI du M5Stack (préconfiguré dans M5LoRa)
    LoRa.setPins(LORA_CS, LORA_RST, LORA_IRQ);

    if (!LoRa.begin(LORA_FREQUENCY)) {
        Serial.println("[LoRa] Echec initialisation !");
        M5.Lcd.println("LoRa ERREUR !");
        while (1);
    }

    // Paramètres LoRa (à adapter selon le réseau)
    LoRa.setSpreadingFactor(7);      // SF7 = rapide, SF12 = longue portée
    LoRa.setSignalBandwidth(125E3);  // 125 kHz
    LoRa.setCodingRate4(5);          // 4/5
    LoRa.setTxPower(17);             // Puissance max EU = 14 dBm (sans antenne boostée)

    Serial.println("[LoRa] Initialise sur 868 MHz");
}

void drawUI() {
    M5.Lcd.fillScreen(BLACK);
    M5.Lcd.setTextColor(CYAN);
    M5.Lcd.setTextSize(2);
    M5.Lcd.setCursor(10, 10);
    M5.Lcd.println("M5Stack LoRa 868");

    M5.Lcd.setTextColor(WHITE);
    M5.Lcd.setTextSize(1);
    M5.Lcd.setCursor(10, 50);
    M5.Lcd.println("BtnA = Envoyer");
    M5.Lcd.setCursor(10, 65);
    M5.Lcd.println("BtnB = Ecouter");

    M5.Lcd.drawLine(0, 90, 320, 90, DARKGREY);
}

void sendLoRaPacket() {
    String message = "M5GO-MSG-" + String(msgCount++);

    Serial.println("[TX] Envoi: " + message);

    M5.Lcd.fillRect(0, 100, 320, 140, BLACK);
    M5.Lcd.setTextColor(GREEN);
    M5.Lcd.setTextSize(1);
    M5.Lcd.setCursor(10, 105);
    M5.Lcd.println("[TX] Envoi:");
    M5.Lcd.setCursor(10, 120);
    M5.Lcd.setTextSize(2);
    M5.Lcd.println(message);

    LoRa.beginPacket();
    LoRa.print(message);
    LoRa.endPacket();

    M5.Lcd.setCursor(10, 160);
    M5.Lcd.setTextSize(1);
    M5.Lcd.setTextColor(DARKGREY);
    M5.Lcd.println("Envoye !");
}

void receiveLoRaPacket() {
    Serial.println("[RX] Ecoute en cours...");

    M5.Lcd.fillRect(0, 100, 320, 140, BLACK);
    M5.Lcd.setTextColor(YELLOW);
    M5.Lcd.setTextSize(1);
    M5.Lcd.setCursor(10, 105);
    M5.Lcd.println("[RX] En ecoute...");

    // Écoute pendant 5 secondes
    unsigned long startTime = millis();
    while (millis() - startTime < 5000) {
        int packetSize = LoRa.parsePacket();
        if (packetSize) {
            String received = "";
            while (LoRa.available()) {
                received += (char)LoRa.read();
            }

            int rssi = LoRa.packetRssi();
            float snr = LoRa.packetSnr();

            Serial.println("[RX] Recu: " + received);
            Serial.println("[RX] RSSI: " + String(rssi) + " dBm | SNR: " + String(snr) + " dB");

            M5.Lcd.fillRect(0, 100, 320, 140, BLACK);
            M5.Lcd.setTextColor(ORANGE);
            M5.Lcd.setCursor(10, 105);
            M5.Lcd.println("[RX] Recu:");
            M5.Lcd.setCursor(10, 120);
            M5.Lcd.setTextSize(2);
            M5.Lcd.setTextColor(WHITE);
            M5.Lcd.println(received);
            M5.Lcd.setCursor(10, 160);
            M5.Lcd.setTextSize(1);
            M5.Lcd.setTextColor(DARKGREY);
            M5.Lcd.print("RSSI: ");
            M5.Lcd.print(rssi);
            M5.Lcd.print(" dBm | SNR: ");
            M5.Lcd.print(snr);
            M5.Lcd.println(" dB");

            // Envoi des donnees recues LoRa via API
            sendDataToAPI(received, rssi, snr);

            return;
        }
        delay(10);
    }

    // Timeout
    M5.Lcd.setCursor(10, 130);
    M5.Lcd.setTextColor(RED);
    M5.Lcd.println("Aucun paquet recu (5s)");
    Serial.println("[RX] Timeout - aucun paquet");
}

void setup() {
    M5.begin();
    Serial.begin(115200);

    M5.Lcd.setBrightness(100);
    drawUI();

    Serial.println("=== M5Stack LoRa 868MHz ===");

    // Initialisation et connexion du WiFi au demarrage
    setupWiFi();

    setupLoRa();

    M5.Lcd.setTextColor(GREEN);
    M5.Lcd.setCursor(10, 100);
    M5.Lcd.println("LoRa OK ! Pret.");
}

void loop() {
    M5.update(); // Mise à jour des boutons

    // Bouton A = Envoyer un paquet
    if (M5.BtnA.wasPressed()) {
        sendLoRaPacket();
    }

    // Bouton B = Écouter les paquets
    if (M5.BtnB.wasPressed()) {
        receiveLoRaPacket();
    }

    // Bouton C = Reset compteur
    if (M5.BtnC.wasPressed()) {
        msgCount = 0;
        drawUI();
        M5.Lcd.setTextColor(PURPLE);
        M5.Lcd.setCursor(10, 100);
        M5.Lcd.println("Compteur reset.");
    }

    delay(10);
}
```