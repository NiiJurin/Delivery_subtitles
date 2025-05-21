import React, { useState, useEffect, useRef } from "react";
import "./App.css";

const App = () => {
  const recognizerRef = useRef(null);
  const [subtitleText, setSubtitleText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [logs, setLogs] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [lang, setLang] = useState("ja-JP");
  const [autoRestart, setAutoRestart] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [bgColor, setBgColor] = useState("#00ff00");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoId, setVideoId] = useState(""); // 今回はURLごと送る
  const [danmaku, setDanmaku] = useState([]);

  const [subtitleStyle, setSubtitleStyle] = useState({
    fontSize: "36px",
    fontFamily: "Inter",
    color: "black",
    outline: "white"
  });

  // 音声認識
  useEffect(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      alert("このブラウザは音声認識に対応していません");
      return;
    }

    if (recognizerRef.current) {
      recognizerRef.current.abort();
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognizer = new SpeechRecognition();

    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = lang;

    recognizer.onstart = () => setIsListening(true);
    recognizer.onend = () => {
      setIsListening(false);
      if (autoRestart && recognizerRef.current) {
        recognizerRef.current.start();
      }
    };

    recognizer.onresult = (event) => {
      const results = [...event.results].slice(event.resultIndex);
      results.forEach((result) => {
        const text = result[0].transcript.trim();
        if (!result.isFinal) {
          setInterimText(text);
        }
        if (result.isFinal && text !== "") {
          setSubtitleText(text);
          setInterimText("");
          setLogs((prevLogs) => [...prevLogs, text]);
        }
      });
    };

    recognizerRef.current = recognizer;
  }, [lang, autoRestart]);

  const startRecognition = () => {
    if (recognizerRef.current) recognizerRef.current.start();
  };

  const stopRecognition = () => {
    if (recognizerRef.current) recognizerRef.current.stop();
  };

  const resetText = () => {
    setSubtitleText("");
    setInterimText("");
    setLogs([]);
  };

  const toggleLanguage = () => {
    setLang((prevLang) => (prevLang === "ja-JP" ? "en-US" : "ja-JP"));
  };

  // 弾幕WebSocket
  useEffect(() => {
    if (!videoId) return;
    const ws = new window.WebSocket("ws://localhost:3002");
    ws.onopen = () => ws.send(videoId); // videoIdはURLごと送る
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      setDanmaku(prev => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          text: msg.text,
          top: Math.random() * 220 + 10 // 10~230pxくらいの範囲で上下にバラす
        }
      ]);
    };
    return () => ws.close();
  }, [videoId]);

  return (
    <div className="app-container">
      <div className="header">
        音声リアルタイム文字起こし
        <div className="controls">
          <button
            className={`record-btn ${isListening ? "active" : ""}`}
            onClick={isListening ? stopRecognition : startRecognition}
          >
            {isListening ? "■ 録音停止" : "● 録音開始"}
          </button>
          <button onClick={resetText}>リセット</button>
          <button onClick={toggleLanguage}>
            {lang === "ja-JP" ? "英語に切り替え" : "日本語に切り替え"}
          </button>
          <button onClick={() => setAutoRestart(!autoRestart)}>
            {autoRestart ? "🔁 自動再起動ON" : "⏹️ 自動再起動OFF"}
          </button>
          <button onClick={() => setShowSettings(true)}>⚙️ 設定</button>
        </div>
        <span className="status-indicator">
          {isListening && <span className="dot"></span>}{" "}
          {isListening ? "録音中..." : "停止中"}
        </span>
      </div>

      <div className="main-content">
        <div className="chromakey-area" style={{ backgroundColor: bgColor }}>
          {/* 弾幕コメント */}
          {danmaku.map((d) => (
            <span
              key={d.id}
              className="danmaku"
              style={{ top: d.top }}
            >{d.text}</span>
          ))}
          {/* 音声認識字幕 */}
          <div
            className="subtitle"
            style={{
              fontSize: subtitleStyle.fontSize,
              fontFamily: subtitleStyle.fontFamily,
              color: subtitleStyle.color,
              textShadow: `
                -2px -2px 0 ${subtitleStyle.outline},
                 2px -2px 0 ${subtitleStyle.outline},
                -2px  2px 0 ${subtitleStyle.outline},
                 2px  2px 0 ${subtitleStyle.outline}
              `
            }}
          >
            {interimText || subtitleText}
          </div>
        </div>

        {/* 右カラム(log-area)の最上部にdanmaku-url-rowを追加 */}
        <div className="log-area">
          <div className="danmaku-url-row">
            <input
              type="text"
              placeholder="YouTube配信URLを入力"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              style={{
                width: 260,
                padding: 6,
                fontSize: 15,
                borderRadius: 4,
                border: "1px solid #ccc",
                marginRight: 8,
              }}
            />
            <button
              style={{
                padding: "7px 16px",
                fontSize: 15,
                borderRadius: 4,
                background: "#2a5298",
                color: "#fff",
                border: "none",
                fontWeight: "bold",
              }}
              onClick={() => setVideoId(videoUrl)} // URLごとサーバーへ
            >弾幕開始</button>
          </div>
          <h3>認識ログ</h3>
          <div className="log-list">
            {logs.map((log, index) => (
              <div key={index} className="log-item">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="settings-modal modern">
          <h3>⚙️ 字幕スタイル設定</h3>
          {/* フォントサイズ */}
          <label>
            フォントサイズ:
            <div className="size-control">
              <button
                onClick={() =>
                  setSubtitleStyle((prev) => ({
                    ...prev,
                    fontSize: `${Math.max(10, parseInt(prev.fontSize) - 2)}px`,
                  }))
                }
              >
                −
              </button>
              <span>{subtitleStyle.fontSize}</span>
              <button
                onClick={() =>
                  setSubtitleStyle((prev) => ({
                    ...prev,
                    fontSize: `${parseInt(prev.fontSize) + 2}px`,
                  }))
                }
              >
                ＋
              </button>
            </div>
          </label>
          {/* フォント種類 */}
          <label>
            フォント種類:
            <select
              value={subtitleStyle.fontFamily}
              onChange={(e) =>
                setSubtitleStyle((prev) => ({
                  ...prev,
                  fontFamily: e.target.value
                }))
              }
            >
              <option value="Inter">Inter</option>
              <option value="Roboto">Roboto</option>
              <option value="Arial">Arial</option>
              <option value="Kosugi Maru">Kosugi Maru</option>
              <option value="'M PLUS Rounded 1c'">M PLUS Rounded</option>
              <option value="'Zen Kaku Gothic New'">Zen Kaku Gothic</option>
              <option value="sans-serif">sans-serif</option>
            </select>
          </label>
          {/* 文字色 */}
          <label>
            文字色:
            <input
              type="color"
              value={subtitleStyle.color}
              onChange={(e) =>
                setSubtitleStyle((prev) => ({ ...prev, color: e.target.value }))
              }
              className="color-input"
            />
          </label>
          {/* 縁色 */}
          <label>
            縁色:
            <input
              type="color"
              value={subtitleStyle.outline}
              onChange={(e) =>
                setSubtitleStyle((prev) => ({ ...prev, outline: e.target.value }))
              }
              className="color-input"
            />
          </label>
          <label>
            背景色（クロマキー）:
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="color-input"
            />
          </label>
          <button onClick={() => setShowSettings((prev) => !prev)}>
            {showSettings ? "❌ 設定を閉じる" : "⚙️ 設定"}
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
