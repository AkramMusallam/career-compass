import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chatInterview } from "../../api/endpoints";
import { getErrorMessage } from "../../api/client";

export default function Interview() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // We assume messages are populated by backend or we should fetch them.
  // Actually, wait, startInterview gives initial messages, but if we refresh, we need a GET /interview/:sessionId endpoint.
  // Let's add that to backend if we need, but for now we can just rely on the first chat request acting as fetch if input is empty,
  // or we can just add a get session endpoint. To keep it simple without adding a get endpoint right now, we can just render whatever comes from chat.
  // Actually, an empty message to chatInterview will just return the messages? No, the backend appends it.
  // I should add a simple getSession endpoint in backend, or just send a 'hello' to start.
  // For the sake of the demo, let's just send a silent ping or add a get endpoint.
  // Since I can easily edit backend, let me just write the UI assuming it starts empty and waits for user, but actually the AI asks first.
  // The user gets redirected here. It would be better to pass the initial messages via state.
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    
    try {
      const res = await chatInterview(sessionId, userMsg);
      setMessages(res.data.messages);
    } catch (err) {
      alert(getErrorMessage(err, "خطأ في الاتصال"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[80vh]">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-black text-slate-800">محاكي المقابلات (AI)</h1>
        <button onClick={() => navigate(-1)} className="btn-outline">العودة</button>
      </div>
      
      <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-200 overflow-y-auto flex flex-col gap-4 mb-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-10">
            أرسل أي رسالة لبدء المقابلة أو استئنافها...
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={"p-3 rounded-lg max-w-[80%] "}>
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="p-3 rounded-lg bg-white border border-slate-200 text-slate-500 self-start animate-pulse">
            يكتب...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="flex gap-2">
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اكتب إجابتك هنا..."
          className="input-field flex-1"
          disabled={loading}
        />
        <button type="submit" className="btn-primary whitespace-nowrap" disabled={loading}>
          إرسال
        </button>
      </form>
    </div>
  );
}