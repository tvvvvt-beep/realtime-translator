import { useState } from "react";
import { useRealtime } from "./realtime";

export default function App() {
  const { isConnected, isRecording, translatedText, error, toggleRecording } =
    useRealtime();

  return (
    <div style={styles.container}>
      <h1>🇰🇷 한국어 → 🇯🇵 日本語</h1>

      <div style={styles.status}>
        <p>
          ステータス:{" "}
          {error ? (
            <span style={styles.error}>{error}</span>
          ) : isConnected ? (
            <span style={styles.connected}>接続中</span>
          ) : (
            <span>未接続</span>
          )}
        </p>
      </div>

      <div style={styles.translatedText}>
        {translatedText || "翻訳結果がここに表示されます"}
      </div>

      <button
        style={
          isRecording
            ? { ...styles.button, ...styles.buttonRecording }
            : styles.button
        }
        onClick={toggleRecording}
        disabled={!isConnected}
      >
        {isRecording ? "🛑 停止" : "🎤 録音開始"}
      </button>

      <div style={styles.instructions}>
        <p>1. 録音開始を押す</p>
        <p>2. 韓国語を話す</p>
        <p>3. 日本語に翻訳される</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "600px",
    margin: "50px auto",
    padding: "20px",
    textAlign: "center",
    fontFamily: "Arial, sans-serif",
  },
  status: {
    marginBottom: "20px",
    fontSize: "14px",
  },
  connected: {
    color: "#22c55e",
    fontWeight: "bold",
  },
  error: {
    color: "#ef4444",
    fontWeight: "bold",
  },
  translatedText: {
    minHeight: "200px",
    padding: "30px",
    backgroundColor: "#f5f5f5",
    borderRadius: "10px",
    fontSize: "24px",
    lineHeight: "1.8",
    marginBottom: "30px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    padding: "15px 40px",
    fontSize: "18px",
    border: "none",
    borderRadius: "50px",
    backgroundColor: "#3b82f6",
    color: "white",
    cursor: "pointer",
    transition: "all 0.3s",
  },
  buttonRecording: {
    backgroundColor: "#ef4444",
  },
  instructions: {
    marginTop: "40px",
    fontSize: "14px",
    color: "#666",
    lineHeight: "2",
  },
};
