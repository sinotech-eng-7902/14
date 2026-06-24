import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));

// Lazy init Gemini client to avoid crash if API Key is not set on startup
let aiClient: GoogleGenAI | null = null;
function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set. Please add it via Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// 1. Text-to-Speech API
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice, style } = req.body;

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "請提供要轉換的逐字稿文字。" });
      return;
    }

    const voiceName = voice || "Kore"; // Puck, Charon, Kore, Fenrir, Zephyr
    const stylePrompt = style || "default";

    // Build specific prompt instructing how to read the text
    let promptPrefix = "";
    if (stylePrompt === "warm") {
      promptPrefix = "請以溫馨、親切、關懷的語調，充滿人情味地朗讀以下內容：\n\n";
    } else if (stylePrompt === "professional") {
      promptPrefix = "請以專業、沉穩、標準的新聞播報腔調，清晰地朗讀以下內容：\n\n";
    } else if (stylePrompt === "energetic") {
      promptPrefix = "請以高亢、活力、熱情、極具說服力的語調，朗讀以下廣播內容：\n\n";
    } else if (stylePrompt === "story") {
      promptPrefix = "請以說故事般、緩慢、溫柔、富有感性與層次的語調，朗讀以下內容：\n\n";
    } else if (stylePrompt === "urgent") {
      promptPrefix = "請以嚴肅、清晰、肯定且帶有提醒感的警示語調，朗讀以下通知內容：\n\n";
    } else {
      promptPrefix = "請以自然、清晰、節奏適中的語音，朗讀以下內容：\n\n";
    }

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `${promptPrefix}${text}` }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      res.status(500).json({ error: "AI 語音生成失敗，未返回音訊數據。" });
      return;
    }

    res.json({
      success: true,
      audioBase64: base64Audio,
      sampleRate: 24000,
      format: "pcm",
    });
  } catch (error: any) {
    console.error("TTS generation error:", error);
    res.status(500).json({ error: error.message || "伺服器內部錯誤" });
  }
});

// 2. Script Polishing & Optimization API
app.post("/api/polish", async (req, res) => {
  try {
    const { text, tone, lengthConstraint } = req.body;

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "請提供要優化的廣播內容。" });
      return;
    }

    const toneType = tone || "natural";
    const length = lengthConstraint || "keep";

    let instruction = "你是一個專業的廣播撰稿人與電台主持人。請幫忙優化並潤飾使用者提供的廣播逐字稿，使其更適合口語播報。";
    instruction += "\n\n請遵守以下優化原則：";
    instruction += "\n1. 將太過書面、冗長的句子調整為適合耳朵聽的口語、流暢句型。";
    instruction += "\n2. 加入自然的語氣連接詞，讓聽覺效果更連貫。";
    instruction += "\n3. 視情況可以使用標點符號（如逗號、頓號、波浪號、省略號）或在括號內加上配音動作提示來引導錄音時的停頓與語氣，例如 (微笑地說)、(稍微停頓) 等。";
    instruction += "\n4. 絕對不要破壞使用者原本想表達的核心訊息與關鍵事實（如日期、電話、地址、人名）。";
    
    if (toneType === "warm") {
      instruction += "\n5. 語氣風格：溫馨親切、充滿關懷，像與老朋友聊天一樣。";
    } else if (toneType === "professional") {
      instruction += "\n5. 語氣風格：專業知性、標準播報、精準且具權威感。";
    } else if (toneType === "energetic") {
      instruction += "\n5. 語氣風格：活力四射、熱情洋溢、極具吸引力與動感。";
    } else if (toneType === "story") {
      instruction += "\n5. 語氣風格：溫柔感性、深沉故事風、緩慢而扣人心弦。";
    } else if (toneType === "urgent") {
      instruction += "\n5. 語氣風格：嚴肅、清晰、肯定，帶有醒目提醒的警示感。";
    }

    if (length === "shorter") {
      instruction += "\n6. 字數限制：比原稿更精簡，去除贅字，適合快速插播。";
    } else if (length === "longer") {
      instruction += "\n6. 字數限制：在原稿基礎上稍微擴寫，增加開場白、結尾問候語，讓內容更完整。";
    } else {
      instruction += "\n6. 字數限制：儘量維持與原稿相近的字數與長度。";
    }

    instruction += "\n\n注意：請直接輸出優化後的廣播逐字稿內容，不要包含任何「好的，以下是為您優化的內容：」或「優化重點：」等解釋文字。";

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: text,
      config: {
        systemInstruction: instruction,
        temperature: 0.7,
      },
    });

    const polishedText = response.text;

    if (!polishedText) {
      res.status(500).json({ error: "AI 潤飾失敗，未返回文字。" });
      return;
    }

    res.json({
      success: true,
      polishedText: polishedText.trim(),
    });
  } catch (error: any) {
    console.error("Script polishing error:", error);
    res.status(500).json({ error: error.message || "伺服器內部錯誤" });
  }
});

// Start function to wrap async Vite Server setup
async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
