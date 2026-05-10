import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.OPENAI_API_KEY || "";

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
    const openaiWs = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-realtime-translate",
      ["realtime", `bearer.${API_KEY}`]
    );

    openaiWs.on("open", () => {
      console.log("Connected to OpenAI");

      // セッション設定
      openaiWs.send(
        JSON.stringify({
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
        })
      );
    });

    // クライアント → OpenAI
    clientWs.on("message", (data) => {
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(data);
      }
    });

    // OpenAI → クライアント
    openaiWs.on("message", (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    });

    // エラー処理
    openaiWs.on("error", (err) => {
      console.error("OpenAI WebSocket error:", err);
    });

    openaiWs.on("close", () => {
      console.log("OpenAI connection closed");
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
