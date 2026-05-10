import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.OPENAI_API_KEY || "";

if (!API_KEY) {
  console.error("ERROR: OPENAI_API_KEY environment variable is not set!");
  process.exit(1);
}

// デバッグ: APIキーの先頭部分をログ出力（セキュリティのため完全なキーは表示しない）
console.log("API_KEY loaded:", API_KEY ? `${API_KEY.slice(0, 7)}...${API_KEY.slice(-4)}` : "EMPTY");
console.log("API_KEY length:", API_KEY.length);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // 静的ファイルを配信
  const staticPath = path.resolve(__dirname, "../dist");
  app.use(express.static(staticPath));

  // SPAルーティング
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  // WebSocketプロキシ
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (clientWs) => {
    console.log("Client connected");

    // OpenAI Realtime APIに接続
    const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview`;
    console.log("Connecting to OpenAI:", wsUrl.replace(API_KEY, "sk-..."));

    const openaiWs = new WebSocket(
      wsUrl,
      ["realtime", `bearer.${API_KEY}`]
    );

    openaiWs.on("open", () => {
      console.log("Connected to OpenAI");

      // セッション設定
      const sessionConfig = {
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          instructions: "You are a real-time translator. Translate Korean speech to Japanese text.",
          voice: "alloy",
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          input_audio_transcription: {
            model: "whisper-1",
          },
        },
      };
      console.log("Sending session config:", JSON.stringify(sessionConfig, null, 2));
      openaiWs.send(JSON.stringify(sessionConfig));
    });

    // クライアント → OpenAI
    clientWs.on("message", (data) => {
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(data);
      }
    });

    // エラー処理
    openaiWs.on("error", (err) => {
      console.error("OpenAI WebSocket error:", err);
      const errorResponse = {
        type: "error",
        error: {
          message: `Failed to connect to OpenAI API: ${err.message || "Unknown error"}. Please check API key.`
        }
      };
      clientWs.send(JSON.stringify(errorResponse));
      clientWs.close();
    });

    // OpenAI → クライアント（エラーメッセージをログに出力）
    openaiWs.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === "error") {
          console.error("OpenAI API error:", message.error);
        }
      } catch (e) {
        // JSON parse error, just forward as-is
      }
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    });

    openaiWs.on("close", (code, reason) => {
      console.log("OpenAI connection closed:", code, reason.toString());
      clientWs.close();
    });

    clientWs.on("close", () => {
      console.log("Client disconnected");
      openaiWs.close();
    });
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
