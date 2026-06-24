export interface BroadcastScript {
  id: string;
  title: string;
  content: string;
  polishedContent: string;
  voice: string;
  style: string;
  createdAt: string;
}

export interface VoiceProfile {
  id: string; // Gemini prebuilt voice name (Puck, Charon, Kore, Fenrir, Zephyr)
  name: string;
  gender: "male" | "female";
  description: string;
  sampleText: string;
}

export interface AudioStyle {
  id: string;
  name: string;
  description: string;
  icon: string;
}
