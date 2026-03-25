#include <SPI.h>
#include <LoRa.h>
#include <ESP8266WiFi.h>

const int csPin = D8;
const int resetPin = D0;
const int irqPin = D1;

byte localAddress = 0xAA;
byte destination  = 0xBB;
byte msgCount = 0;

char payload[256];  // Buffer for JSON

void setup() {
  Serial.begin(9600);
  delay(1000);

  // Disable WiFi to free IRAM
  WiFi.forceSleepBegin();
  delay(10);

  Serial.println("\n\n=== ESP LoRa Sender Starting ===");

  LoRa.setPins(csPin, resetPin, irqPin);

  if (!LoRa.begin(915E6)) {
    Serial.println("Starting LoRa failed!");
    while (1);
  }

  LoRa.setSpreadingFactor(7);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(5);
  LoRa.setPreambleLength(8);
  LoRa.setSyncWord(0x12);
  LoRa.disableCrc();

  Serial.println("Settings: SF7, BW125, CR4/5\n");
}

void loop() {

  if (Serial.available()) {
    int len = Serial.readBytesUntil('\n', payload, sizeof(payload) - 1);
    payload[len] = '\0';

    Serial.print("\n📦 Received JSON payload: ");
    Serial.println(payload);

    sendMessage(destination, payload);
    listenForAck();
  }

  delay(100);
}

void sendMessage(byte dest, const char *outgoing) {
  LoRa.idle();
  delay(20);

  LoRa.beginPacket();
  LoRa.write(dest);
  LoRa.write(localAddress);
  LoRa.write(msgCount);

  byte len = strlen(outgoing);
  LoRa.write(len);

  LoRa.write((uint8_t*)outgoing, len);

  if (LoRa.endPacket()) {
    Serial.printf("✅ Sent #%d to 0x%X | %d bytes\", msgCount, dest, len);
  } else {
    Serial.println("❌ Send FAILED!");
  }

  msgCount++;
}

void listenForAck() {
  Serial.println("🎧 Listening for ACK...");
  LoRa.receive();

  unsigned long start = millis();

  while (millis() - start < 2000) {
    int packetSize = LoRa.parsePacket();
    if (packetSize) {
      byte recip = LoRa.read();
      byte sender = LoRa.read();
      byte msgId = LoRa.read();
      byte len = LoRa.read();

      char ack[64];
      int i = 0;

      while (LoRa.available() && i < sizeof(ack) - 1) {
        ack[i++] = LoRa.read();
      }
      ack[i] = '\0';

      Serial.printf("ACK from 0x%X: [%s]\n", sender, ack);
      return;
    }
    yield();
  }

  Serial.println("⚠️ No ACK received");
}
