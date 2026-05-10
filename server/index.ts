import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.OPENAI_API_KEY || "";

// 前後の空白を削除
const cleanedApiKey = API_KEY.trim();

// APIキーのチェックは接続時に行う（サーバー起動を継続する）
if (!cleanedApiKey) {
  console.warn("WARNING: OPENAI_API_KEY environment variable is not set!");
  console.warn("The server will start but translation will not work.");
  console.warn("Set OPENAI_API_KEY environment variable to enable translation.");
}

// デバッグ: APIキーの先頭部分をログ出力（セキュリティのため完全なキーは表示しない）
console.log("API_KEY loaded:", cleanedApiKey ? `${cleanedApiKey.slice(0, 7)}...${cleanedApiKey.slice(-4)}` : "EMPTY");
console.log("API_KEY length:", cleanedApiKey.length);
console.log("API_KEY starts with 'sk-proj-'?:", cleanedApiKey.startsWith("sk-proj-"));

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

    // OpenAI Realtime Translation APIに接続
    const wsUrl = `wss://api.openai.com/v1/realtime/translations?model=gpt-realtime-translate`;
    console.log("Connecting to OpenAI:", wsUrl);

    const openaiWs = new WebSocket(
      wsUrl,
      {
        headers: {
          "Authorization": `Bearer ${cleanedApiKey}`,
          "OpenAI-Safety-Identifier": "user-" + Date.now(),
        },
      }
    );

    openaiWs.on("open", () => {
      console.log("Connected to OpenAI");

      // セッション設定 (Translation API専用)
      const sessionConfig = {
        type: "session.update",
        session: {
          instructions: "You are a real-time translator. Translate Korean speech to Japanese text.",
          voice: "alloy",
          input: {
            audio: {
              format: "pcm16",
            },
            language: "ko", // 入力言語: 韓国語
          },
          output: {
            audio: {
              format: "pcm16",
            },
            language: "ja", // 出力言語: 日本語
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
          console.error("OpenAI API error type:", message.error?.type);
          console.error("OpenAI API error code:", message.error?.code);
          console.error("OpenAI API error message:", message.error?.message);
          console.error("OpenAI API error param:", message.error?.param);
        }
      } catch (e) {
        // JSON parse error, just forward as-is
        console.log("Non-JSON message from OpenAI");
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
    console.log("Environment check:");
    console.log(`- PORT: ${process.env.PORT || "default (3000)"}`);
    console.log(`- OPENAI_API_KEY set: ${!!process.env.OPENAI_API_KEY}`);
    console.log(`- Node version: ${process.version}`);
  });
}

startServer().catch(console.error);
