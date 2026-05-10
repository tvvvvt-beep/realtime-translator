import { useEffect, useRef, useState, useCallback } from "react";

export function useRealtime() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [translatedText, setTranslatedText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // WebSocket接続
  const connect = useCallback(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws`);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // テキスト応答を処理
      if (data.type === "conversation.item.created") {
        if (data.item?.content?.[0]?.text) {
          setTranslatedText(data.item.content[0].text);
        }
      }

      // トランスクリプションを処理
      if (data.type === "conversation.item.input_audio_transcription.completed") {
        console.log("Transcription:", data.transcript);
      }
    };

    ws.onerror = (event) => {
      console.error("WebSocket error:", event);
      setError("接続エラーが発生しました");
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
      setIsConnected(false);
    };

    wsRef.current = ws;
  }, []);

  // 録音開始・停止
  const toggleRecording = useCallback(async () => {
    if (!wsRef.current || !isConnected) {
      setError("接続されていません");
      return;
    }

    if (isRecording) {
      // 停止
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      setIsRecording(false);
    } else {
      // 開始
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "audio/webm",
        });

        mediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && wsRef.current) {
            const arrayBuffer = await event.data.arrayBuffer();

            // PCM16に変換して送信
            wsRef.current.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: arrayBufferToBase16(arrayBuffer),
              })
            );
          }
        };

        mediaRecorder.start(100); // 100msごとにデータを送信
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
        setError(null);
      } catch (err) {
        console.error("Error accessing microphone:", err);
        setError("マイクにアクセスできません");
      }
    }
  }, [isConnected, isRecording]);

  // コンポーネントマウント時に接続
  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [connect]);

  return {
    isConnected,
    isRecording,
    translatedText,
    error,
    toggleRecording,
  };
}

// ArrayBufferをBase16（PCM16）に変換
function arrayBufferToBase16(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
