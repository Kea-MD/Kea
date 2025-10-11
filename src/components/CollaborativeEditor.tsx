"use client";

import React, { useState } from "react";
import { useYjsCollab } from "./useYjsCollab";

export default function CollaborativeEditor({ fileName = "typrmd-demo" }) {
  const [inputValue, setInputValue] = useState<string>("");
  const [signalingServer, setSignalingServer] = useState<string>("");
  const [content, setContent] = useYjsCollab(fileName, signalingServer);

  const handleSetServer = () => {
    setSignalingServer(inputValue.trim());
  };

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <label>
          Signaling Server (ws://LAN_IP:4444):{" "}
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="ws://192.168.1.100:4444"
            style={{ width: "300px" }}
          />
          <button
            type="button"
            style={{ marginLeft: "1rem" }}
            onClick={handleSetServer}
            disabled={!inputValue.startsWith("ws://")}
          >
            Connect
          </button>
        </label>
      </div>
      <textarea
        style={{ width: "100%", height: "300px", fontSize: "1rem" }}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Start typing markdown..."
      />
    </div>
  );
}