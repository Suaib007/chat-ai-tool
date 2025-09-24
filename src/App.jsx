// App.jsx
import { useEffect, useRef, useState } from "react";
import "./App.css";
import { URL } from "./constants.js";
import Answer from "./components/Answers.jsx";

function safeParseHistory() {
  try {
    const raw = localStorage.getItem("history");
    if (!raw) return []; // nothing saved yet
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Could not parse history from localStorage, resetting.", e);
    localStorage.removeItem("history");
    return [];
  }
}

export default function App() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState([]);
  const [recentHistory, setRecentHistory] = useState(() => safeParseHistory());
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Always scroll to bottom when result changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [result]);

  // Robust askQuestion: accepts optional textParam (from recent click)
  const askQuestion = async (textParam = null) => {
    const textToAsk = textParam ?? question;
    if (!textToAsk) return;

    try {
      // ----- localStorage handling (safe) -----
      const raw = localStorage.getItem("history");
      let history = [];
      if (raw) {
        try {
          history = JSON.parse(raw);
          if (!Array.isArray(history)) history = [];
        } catch (e) {
          history = [];
        }
      }

      // avoid duplicate immediate entries
      if (history[0] !== textToAsk) {
        // prepend new question and remove duplicates
        history = [textToAsk, ...history];

        // remove duplicates while preserving order
        history = history.filter((item, idx) => history.indexOf(item) === idx);

        // limit to 50
        history = history.slice(0, 50);

        // save back
        localStorage.setItem("history", JSON.stringify(history));
        setRecentHistory(history);
        222222;
      }

      // show the question immediately in UI (user bubble)
      setResult((prev) => [...prev, { type: "q", text: textToAsk }]);

      // prepare payload (format your backend expects)
      const payload = {
        contents: [
          {
            parts: [{ text: textToAsk }],
          },
        ],
      };

      // ----- call backend/API -----
      const response = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "No details");
        throw new Error(`Server returned ${response.status}: ${text}`);
      }

      const data = await response.json();

      // safely access nested fields
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      // parse into array of answers (if format uses "* " bullets)
      const dataString = rawText
        .split("* ")
        .map((item) => item.trim())
        .filter(Boolean);

      // append assistant reply
      setResult((prev) => [...prev, { type: "a", text: dataString }]);

      return dataString;
    } catch (err) {
      console.error("askQuestion error:", err);
      setResult((prev) => [
        ...prev,
        { type: "error", text: "Kuch problem hua — dobara try karo." },
      ]);
      return null;
    }
  };

  // click handler for recent history item:
  // start the request with the clicked text, then clear input immediately
  const onRecentClick = (item) => {
    // call with the clicked text (askQuestion uses textParam)
    askQuestion(item);
    // clear the input so textbox appears empty
    setQuestion("");
  };

  const clearHistory = () => {
    localStorage.removeItem("history");
    setRecentHistory([]);
  };

  const isEnter = (event) => {
    if (event.key === "Enter") {
      askQuestion();
      setQuestion("");
    }
  };

  return (
    <div className="grid grid-cols-5 h-screen text-center bg-zinc-900">
      {/* Sidebar: Recent Search */}
      <aside className="col-span-1 bg-zinc-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl text-white">Recent Search</h2>
          <button
            onClick={clearHistory}
            className="text-gray-300 hover:text-white p-1"
            title="Clear history"
          >
            {/* trash icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="18px"
              viewBox="0 -960 960 960"
              width="18px"
              fill="currentColor"
            >
              <path d="M312-144q-29.7 0-50.85-21.15Q240-186.3 240-216v-480h-48v-72h192v-48h192v48h192v72h-48v479.57Q720-186 698.85-165T648-144H312Zm336-552H312v480h336v-480ZM384-288h72v-336h-72v336Zm120 0h72v-336h-72v336ZM312-696v480-480Z" />
            </svg>
          </button>
        </div>

        <div
          className="h-[85vh] overflow-auto pr-2"
          style={{ scrollbarGutter: "stable" }}
        >
          <ul className="text-left">
            {recentHistory.length === 0 && (
              <li className="text-gray-300">No recent searches</li>
            )}
            {recentHistory.map((item, idx) => (
              <li
                key={idx}
                onClick={() => onRecentClick(item)}
                className="pl-2 py-2 truncate text-gray-200 cursor-pointer hover:bg-zinc-600 hover:text-white rounded"
                title={item}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Main chat area */}
      <main className="col-span-4 p-8 relative">
        <div className="bg-transparent h-[78vh] rounded overflow-auto p-4 relative">
          {result.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-2xl font-semibold opacity-70">
              What are you working on?
            </div>
          )}
          <div className="text-zinc-200">
            <ul>
              {result.map((item, index) => {
                // index is okay as key here because we always append only
                return (
                  <li
                    key={index}
                    className={
                      item.type === "q"
                        ? "flex justify-end mb-4"
                        : "flex justify-start mb-4"
                    }
                  >
                    {item.type === "q" ? (
                      <div className="bg-zinc-700 text-right p-3 rounded-tl-3xl rounded-br-3xl rounded-bl-3xl max-w-[70%]">
                        <Answer
                          ans={item.text}
                          totalResult={1}
                          index={index}
                          type={item.type}
                        />
                      </div>
                    ) : item.type === "a" && Array.isArray(item.text) ? (
                      <div className="bg-zinc-800 text-left p-3 rounded-tr-3xl rounded-bl-3xl rounded-br-3xl max-w-[70%]">
                        {item.text.map((ansItem, ansIndex) => (
                          <div key={ansIndex} className="mb-2">
                            <Answer
                              ans={ansItem}
                              totalResult={item.text.length}
                              type={item.type}
                              index={ansIndex}
                            />
                          </div>
                        ))}
                      </div>
                    ) : item.type === "error" ? (
                      <div className="text-red-400 p-2">{item.text}</div>
                    ) : (
                      <div className="text-left p-3">
                        <Answer
                          ans={String(item.text)}
                          totalResult={1}
                          type={item.type}
                          index={0}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
              <div ref={messagesEndRef} />
            </ul>
          </div>
        </div>

        {/* Input area - fixed near bottom visually */}
        <div className="absolute left-1/2 transform -translate-x-1/2 bottom-6 w-2/3">
          <div className="bg-zinc-700 flex items-center rounded-full border border-zinc-600 px-4 py-3">
            <input
              type="text"
              value={question}
              onKeyDown={isEnter}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask me anything"
              className="flex-1 bg-transparent outline-none text-gray-200 px-4"
            />
            <button
              onClick={() => {
                askQuestion();
                setQuestion("");
              }}
              className="ml-4 text-gray-200 px-4 py-2 rounded-full bg-zinc-600 hover:bg-zinc-500"
            >
              Ask
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
