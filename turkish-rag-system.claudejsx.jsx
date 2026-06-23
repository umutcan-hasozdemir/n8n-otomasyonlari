import { useState, useRef, useCallback, useEffect } from "react";
import mammoth from "mammoth";

const SYSTEM_PROMPT = `Sen bir Türkçe RAG asistanısın. Kullanıcının yüklediği belgelerden soru-cevap yaparsın.

KURALLAR:
1. YALNIZCA verilen belge içeriklerine dayanarak cevap ver
2. Belge bağlamında olmayan bilgileri kesinlikle uydurma
3. Bilgi yoksa "Bu bilgi yüklenen belgelerde bulunamadı." de
4. Hangi belgeden aldığını belirt
5. Türkçe, anlaşılır ve net cevap ver`;

// ── Storage ──────────────────────────────────────────────────────────────────
const DOCS_KEY = "rag:docs3";
async function loadDocs() {
  try { const r = await window.storage.get(DOCS_KEY); return r ? JSON.parse(r.value) : []; } catch { return []; }
}
async function saveDocs(docs) {
  try { await window.storage.set(DOCS_KEY, JSON.stringify(docs)); } catch {}
}

// ── File helpers ─────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function fileToArrayBuffer(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsArrayBuffer(file);
  });
}

const ACCEPT = ".txt,.md,.pdf,.docx,.doc";
const FILE_ICONS = { pdf: "📕", docx: "📘", doc: "📘", txt: "📝", md: "📝" };

function extOf(name) { return name.split(".").pop().toLowerCase(); }

// ── Build Claude content blocks ───────────────────────────────────────────────
function buildContext(docs) {
  const blocks = [];
  for (const doc of docs) {
    if (doc.type === "pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.b64 }, title: doc.name });
    } else {
      // docx/txt/md — plain text
      blocks.push({ type: "text", text: `[Belge: ${doc.name}]\n${doc.text}` });
    }
  }
  return blocks;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [docs, setDocs]       = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [tab, setTab]         = useState("chat");
  const [dragOver, setDragOver] = useState(false);
  const [ready, setReady]     = useState(false);
  const fileRef  = useRef();
  const bottomRef = useRef();

  useEffect(() => { loadDocs().then(d => { setDocs(d); setReady(true); }); }, []);

  // ── Process uploaded files ─────────────────────────────────────────────────
  const handleFiles = useCallback(async (files) => {
    setUploading(true);
    const newDocs = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = extOf(file.name);
      setUploadStatus(`${i + 1}/${files.length} — "${file.name}" işleniyor…`);
      const base = { id: `${Date.now()}-${i}`, name: file.name, size: file.size, ext, addedAt: new Date().toISOString() };

      try {
        if (ext === "pdf") {
          const b64 = await fileToBase64(file);
          newDocs.push({ ...base, type: "pdf", b64 });

        } else if (ext === "docx" || ext === "doc") {
          const ab = await fileToArrayBuffer(file);
          const result = await mammoth.extractRawText({ arrayBuffer: ab });
          newDocs.push({ ...base, type: "text", text: result.value || "[Boş belge]" });

        } else {
          const text = await file.text().catch(() => "");
          newDocs.push({ ...base, type: "text", text });
        }
      } catch (e) {
        newDocs.push({ ...base, type: "text", text: `[Okuma hatası: ${e.message}]` });
      }
    }

    const updated = [...docs, ...newDocs];
    setDocs(updated);
    await saveDocs(updated);
    setUploading(false);
    setUploadStatus("");
    setTab("chat");
  }, [docs]);

  const removeDoc = useCallback(async (id) => {
    const updated = docs.filter(d => d.id !== id);
    setDocs(updated);
    await saveDocs(updated);
  }, [docs]);

  const clearAll = useCallback(async () => {
    if (!confirm("Tüm belgeler silinsin mi?")) return;
    setDocs([]); setMessages([]);
    await window.storage.delete(DOCS_KEY).catch(() => {});
  }, []);

  // ── Send ───────────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    if (!input.trim() || loading || docs.length === 0) return;
    const q = input.trim();
    const newMsgs = [...messages, { role: "user", content: q }];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);

    const contextBlocks = buildContext(docs);
    const userContent   = [...contextBlocks, { type: "text", text: `Soru: ${q}` }];
    const history = newMsgs.slice(-8, -1).map(m => ({ role: m.role, content: m.content }));

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [...history, { role: "user", content: userContent }],
        }),
      });
      const data  = await resp.json();
      const reply = data.content?.map(b => b.text || "").join("") || JSON.stringify(data);
      setMessages(prev => [...prev, { role: "assistant", content: reply, sources: docs.map(d => d.name) }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Hata: " + e.message, error: true }]);
    }
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [input, loading, docs, messages]);

  const totalKB = docs.reduce((a, d) => a + d.size, 0) / 1024;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#05080f", fontFamily: "'DM Mono','Courier New',monospace", color: "#c9d1d9" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Libre+Baskerville:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:#05080f}
        ::-webkit-scrollbar-thumb{background:#1c3358;border-radius:2px}
        .tab-btn{background:none;border:none;cursor:pointer;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;padding:10px 20px;color:#4a5568;border-bottom:2px solid transparent;transition:all .2s}
        .tab-btn.on{color:#58a6ff;border-bottom-color:#58a6ff}
        .tab-btn:hover:not(.on){color:#8b949e}
        .send-btn{background:linear-gradient(135deg,#1447a0,#2563eb);border:none;color:#e2e8f0;cursor:pointer;border-radius:6px;font-family:'DM Mono',monospace;font-size:12px;font-weight:500;letter-spacing:.06em;padding:11px 22px;white-space:nowrap;transition:all .2s}
        .send-btn:hover:not(:disabled){box-shadow:0 0 20px rgba(37,99,235,.4);transform:translateY(-1px)}
        .send-btn:disabled{opacity:.35;cursor:not-allowed}
        .q-input{flex:1;background:#0d1117;border:1px solid #1c2c3e;color:#c9d1d9;border-radius:6px;padding:11px 16px;font-family:'DM Mono',monospace;font-size:13px;outline:none;transition:border-color .2s}
        .q-input:focus{border-color:#2563eb}
        .q-input::placeholder{color:#3d4f61}
        .drop-area{border:1.5px dashed #1c3358;border-radius:10px;padding:48px 32px;text-align:center;cursor:pointer;transition:all .25s;background:rgba(37,99,235,.02)}
        .drop-area.over,.drop-area:hover{border-color:#2563eb;background:rgba(37,99,235,.06)}
        .doc-row{display:flex;align-items:center;gap:14px;background:#0d1117;border:1px solid #1c2c3e;border-radius:8px;padding:14px 16px;transition:border-color .2s}
        .doc-row:hover{border-color:#2563eb}
        .del-btn{background:none;border:none;color:#3d4f61;cursor:pointer;font-size:18px;padding:2px 6px;transition:color .2s}
        .del-btn:hover{color:#e85858}
        .bubble{border-radius:10px;padding:14px 18px;line-height:1.7;font-size:13.5px;font-family:'Libre Baskerville',serif;white-space:pre-wrap;word-break:break-word;max-width:82%}
        .src-tag{display:inline-block;font-size:10px;padding:2px 9px;background:rgba(88,166,255,.08);border:1px solid rgba(88,166,255,.18);border-radius:10px;color:#58a6ff;margin:3px 3px 0 0;font-family:'DM Mono',monospace}
        .badge{font-size:9px;padding:2px 8px;border-radius:4px;font-family:'DM Mono',monospace;letter-spacing:.06em}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        .blink{animation:blink 1.1s infinite}
        @keyframes fadeup{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fadeup{animation:fadeup .3s ease}
      `}</style>

      {/* HEADER */}
      <header style={{ background:"#080c14", borderBottom:"1px solid #141e2e", padding:"14px 28px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:36, height:36, borderRadius:8, background:"linear-gradient(135deg,#1447a0,#2563eb)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, boxShadow:"0 0 16px rgba(37,99,235,.3)" }}>🗂</div>
          <div>
            <div style={{ fontFamily:"'Libre Baskerville',serif", fontSize:15, fontWeight:700, color:"#e6edf3", letterSpacing:".03em" }}>TÜRKÇE RAG SİSTEMİ</div>
            <div style={{ fontSize:10, color:"#3d4f61", letterSpacing:".14em", marginTop:1 }}>PDF · WORD · TXT · MD — SORU CEVAP</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:18, fontSize:12, color:"#3d4f61", fontFamily:"'DM Mono',monospace" }}>
          {ready
            ? <><span style={{ color:"#238636" }}>● AKTİF</span><span>{docs.length} belge</span><span>{totalKB.toFixed(0)} KB</span></>
            : <span className="blink">yükleniyor…</span>}
        </div>
      </header>

      {/* TABS */}
      <div style={{ background:"#080c14", borderBottom:"1px solid #141e2e", padding:"0 28px", display:"flex" }}>
        {[["chat","💬 Soru Sor"],["upload","⊕ Belge Yükle"],["db",`📂 Belgeler (${docs.length})`]].map(([k,label]) => (
          <button key={k} className={`tab-btn ${tab===k?"on":""}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      <main style={{ flex:1, padding:"24px 28px", maxWidth:920, width:"100%", margin:"0 auto", display:"flex", flexDirection:"column" }}>

        {/* ══ CHAT ══ */}
        {tab === "chat" && (
          <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 170px)" }}>
            {docs.length === 0 ? (
              <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20, color:"#3d4f61" }}>
                <div style={{ fontSize:52 }}>📭</div>
                <div style={{ fontFamily:"'Libre Baskerville',serif", fontSize:17, color:"#6e7f8f" }}>Henüz belge yüklenmedi</div>
                <div style={{ fontSize:12, color:"#3d4f61", textAlign:"center", lineHeight:2 }}>
                  PDF, Word (.docx), TXT veya Markdown<br/>dosyalarınızı yükleyerek başlayın.
                </div>
                <button className="send-btn" onClick={() => setTab("upload")}>⊕ Belge Yükle</button>
              </div>
            ) : (
              <>
                <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:14, paddingBottom:16 }}>
                  {messages.length === 0 && (
                    <div className="fadeup" style={{ background:"#0d1117", border:"1px solid #141e2e", borderRadius:10, padding:22 }}>
                      <div style={{ color:"#238636", fontSize:11, letterSpacing:".1em", marginBottom:10 }}>// HAZIR — {docs.length} belge yüklü</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
                        {docs.map(d => (
                          <span key={d.id} style={{ fontSize:11, padding:"3px 10px", background:"rgba(88,166,255,.07)", border:"1px solid rgba(88,166,255,.15)", borderRadius:6, color:"#58a6ff" }}>
                            {FILE_ICONS[d.ext] || "📄"} {d.name}
                          </span>
                        ))}
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                        {["Kaç iş yerinde çalışmış?", "Bu belgeyi özetle", "Ana konular neler?"].map(ex => (
                          <button key={ex} onClick={() => setInput(ex)} style={{ background:"none", border:"1px solid #1c2c3e", borderRadius:6, color:"#4a5568", cursor:"pointer", padding:"8px 14px", textAlign:"left", fontSize:12, fontFamily:"'DM Mono',monospace", transition:"all .2s" }}
                            onMouseOver={e=>{e.currentTarget.style.borderColor="#2563eb";e.currentTarget.style.color="#58a6ff"}}
                            onMouseOut={e=>{e.currentTarget.style.borderColor="#1c2c3e";e.currentTarget.style.color="#4a5568"}}>
                            ↳ {ex}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((m, i) => (
                    <div key={i} className="fadeup" style={{ display:"flex", justifyContent: m.role==="user"?"flex-end":"flex-start" }}>
                      <div>
                        {m.role==="assistant" && <div style={{ fontSize:10, color:"#3d4f61", marginBottom:4, letterSpacing:".08em" }}>AI ASISTAN</div>}
                        <div className="bubble" style={{
                          background: m.role==="user" ? "linear-gradient(135deg,#0f2551,#1447a0)" : m.error ? "#1a0808" : "#0d1117",
                          border: `1px solid ${m.role==="user" ? "#2563eb" : m.error ? "#4a0909" : "#1c2c3e"}`,
                          color: m.error ? "#fca5a5" : "#c9d1d9",
                        }}>
                          {m.content}
                        </div>
                        {m.sources?.length > 0 && (
                          <div style={{ marginTop:6 }}>
                            {[...new Set(m.sources)].map(s => <span key={s} className="src-tag">{FILE_ICONS[extOf(s)]||"📄"} {s}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="fadeup blink" style={{ display:"flex" }}>
                      <div className="bubble" style={{ background:"#0d1117", border:"1px solid #1c2c3e", color:"#3d4f61" }}>
                        ⏳ Belgeler okunuyor, cevap hazırlanıyor…
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef}/>
                </div>

                <div style={{ display:"flex", gap:10, paddingTop:14, borderTop:"1px solid #141e2e" }}>
                  <input className="q-input" value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key==="Enter" && !e.shiftKey && send()}
                    placeholder="Belge hakkında soru sorun…" />
                  <button className="send-btn" onClick={send} disabled={loading||!input.trim()||docs.length===0}>
                    {loading ? "…" : "Gönder ↵"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ UPLOAD ══ */}
        {tab === "upload" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20, paddingTop:4 }}>
            <div style={{ fontSize:11, color:"#3d4f61", letterSpacing:".1em" }}>// BELGE YÜKLE</div>

            {/* Format badges */}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {[["📕 PDF","rgba(239,68,68,.12)","rgba(239,68,68,.25)","#fca5a5"],
                ["📘 Word .docx","rgba(37,99,235,.12)","rgba(37,99,235,.25)","#93c5fd"],
                ["📝 TXT","rgba(34,197,94,.12)","rgba(34,197,94,.25)","#86efac"],
                ["📝 Markdown","rgba(168,85,247,.12)","rgba(168,85,247,.25)","#d8b4fe"]
              ].map(([label,bg,border,color]) => (
                <span key={label} style={{ fontSize:11, padding:"4px 12px", background:bg, border:`1px solid ${border}`, borderRadius:20, color, fontFamily:"'DM Mono',monospace" }}>
                  {label}
                </span>
              ))}
            </div>

            <div
              className={`drop-area${dragOver?" over":""}`}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)); }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
            >
              <div style={{ fontSize:40, marginBottom:14 }}>📂</div>
              <div style={{ fontFamily:"'Libre Baskerville',serif", fontSize:15, color:"#8b949e", marginBottom:8 }}>
                Belgeyi buraya sürükleyin veya tıklayın
              </div>
              <div style={{ fontSize:11, color:"#3d4f61", lineHeight:2 }}>
                PDF · Word (.docx) · TXT · MD<br/>
                Birden fazla dosya desteklenir
              </div>
              {uploading && (
                <div style={{ marginTop:18, color:"#58a6ff", fontSize:12 }} className="blink">
                  ⏳ {uploadStatus}
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" multiple accept={ACCEPT} style={{ display:"none" }}
              onChange={e => handleFiles(Array.from(e.target.files))} />

            <div style={{ background:"#0d1117", border:"1px solid #1c2c3e", borderRadius:8, padding:16, fontSize:12, color:"#4a5568", lineHeight:2 }}>
              <span style={{ color:"#238636" }}>// FORMAT DESTEĞİ</span><br/>
              <span style={{ color:"#fca5a5" }}>PDF</span> → base64 olarak doğrudan Claude'a gönderilir<br/>
              <span style={{ color:"#93c5fd" }}>Word (.docx)</span> → mammoth.js ile metin çıkarılır<br/>
              <span style={{ color:"#86efac" }}>TXT / MD</span> → ham metin olarak okunur<br/>
              <span style={{ color:"#58a6ff" }}>→ Tüm belgeler kalıcı olarak saklanır</span>
            </div>
          </div>
        )}

        {/* ══ DB ══ */}
        {tab === "db" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16, paddingTop:4 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:11, color:"#3d4f61", letterSpacing:".1em" }}>// YÜKLÜ BELGELER</div>
              {docs.length > 0 && (
                <button onClick={clearAll} style={{ background:"none", border:"1px solid #4a0909", borderRadius:5, color:"#e85858", cursor:"pointer", fontSize:11, padding:"5px 12px", fontFamily:"'DM Mono',monospace" }}>
                  ⊗ Tümünü Sil
                </button>
              )}
            </div>
            {docs.length === 0 ? (
              <div style={{ textAlign:"center", color:"#3d4f61", padding:"40px 0", fontFamily:"'Libre Baskerville',serif" }}>Henüz belge yok</div>
            ) : (
              docs.map(d => (
                <div key={d.id} className="doc-row">
                  <span style={{ fontSize:22 }}>{FILE_ICONS[d.ext]||"📄"}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, color:"#c9d1d9", fontWeight:500 }}>{d.name}</div>
                    <div style={{ fontSize:11, color:"#3d4f61", marginTop:2 }}>
                      {d.ext.toUpperCase()} · {(d.size/1024).toFixed(1)} KB · {new Date(d.addedAt).toLocaleDateString("tr-TR")}
                      {d.type==="text" && d.text && ` · ${(d.text.length/1000).toFixed(1)}K karakter`}
                    </div>
                  </div>
                  <span className="badge" style={{ background:"rgba(35,134,54,.1)", border:"1px solid rgba(35,134,54,.25)", color:"#238636" }}>✓ KALICI</span>
                  <button className="del-btn" onClick={() => removeDoc(d.id)}>✕</button>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
