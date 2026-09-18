import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { AppShell } from '../components/AppShell';
import { InlineNotice } from '../components/InlineNotice';

// ── Types ────────────────────────────────────────────────────────────────────
interface DocumentVM {
  id: string;
  fileName: string;
  status: 'PROCESSING' | 'READY' | 'FAILED';
  pageCount: number;
  chunkCount: number;
  fileSize: number | null;
  error: string | null;
  createdAt: string;
}

interface SourceVM {
  page: number | null;
  similarity: number;
}

interface ChatMsgVM {
  id: string;
  role: 'user' | 'assistant';
  message: string;
  sources?: SourceVM[] | null;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_STYLES: Record<DocumentVM['status'], { label: string; color: string }> = {
  PROCESSING: { label: 'Processing…', color: 'var(--accent-blue)' },
  READY: { label: 'Ready', color: '#22c55e' },
  FAILED: { label: 'Failed', color: 'var(--accent-red, #e5484d)' },
};

export const MeetScribeAI: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentVM[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsgVM[]>([]);
  const [question, setQuestion] = useState('');
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedDoc = documents.find((d) => d.id === selectedId) || null;

  const loadDocuments = useCallback(async () => {
    try {
      const res = await api.get('/user/pdf');
      setDocuments(res.data.data.documents);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load documents.');
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Poll while any document is still processing.
  useEffect(() => {
    const anyProcessing = documents.some((d) => d.status === 'PROCESSING');
    if (!anyProcessing) return;
    const t = setInterval(loadDocuments, 2500);
    return () => clearInterval(t);
  }, [documents, loadDocuments]);

  // Load chat history when a document is selected.
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/user/pdf/${selectedId}/messages`);
        if (!cancelled) setMessages(res.data.data.messages);
      } catch {
        if (!cancelled) setMessages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('pdf', file);
      const res = await api.post('/user/pdf/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const doc: DocumentVM = res.data.data.document;
      setDocuments((prev) => [doc, ...prev]);
      setSelectedId(doc.id);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/user/pdf/${id}`);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Could not delete the document.');
    }
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || !selectedDoc || selectedDoc.status !== 'READY' || asking) return;

    setQuestion('');
    setAsking(true);
    setError(null);
    // Optimistic user bubble.
    const tempId = `tmp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: 'user', message: q }]);

    try {
      const res = await api.post(`/user/pdf/${selectedDoc.id}/chat`, { question: q });
      const { answer, sources, messageId } = res.data.data;
      setMessages((prev) => [
        ...prev,
        { id: messageId || `a-${Date.now()}`, role: 'assistant', message: answer, sources },
      ]);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Could not get an answer.');
    } finally {
      setAsking(false);
    }
  };

  return (
    <AppShell title="MeetScribe AI">
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
        Chat with your PDFs. Upload a document and ask questions — answers are grounded in the
        document with page citations.
      </p>

      <InlineNotice message={error} variant="error" onDismiss={() => setError(null)} />

      <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', minHeight: 0, height: 'calc(100vh - 220px)' }}>
        {/* ── Documents panel ── */}
        <aside
          style={{
            width: 320,
            flex: '0 0 auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                width: '100%',
                background: 'var(--accent-blue)',
                border: 'none',
                color: '#fff',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                cursor: uploading ? 'default' : 'pointer',
                fontWeight: 600,
                opacity: uploading ? 0.7 : 1,
              }}
            >
              {uploading ? 'Uploading…' : '⬆ Upload PDF'}
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {documents.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', margin: 'auto', padding: 16 }}>
                No documents yet. Upload a PDF to get started.
              </div>
            ) : (
              documents.map((doc) => {
                const status = STATUS_STYLES[doc.status];
                const active = doc.id === selectedId;
                return (
                  <div
                    key={doc.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(doc.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedId(doc.id)}
                    style={{
                      background: active ? 'var(--bg-card-secondary)' : 'transparent',
                      border: `1px solid ${active ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📄 {doc.fileName}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc.id);
                        }}
                        aria-label="Delete document"
                        title="Delete"
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}
                      >
                        🗑
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                      <span style={{ color: status.color, fontWeight: 600 }}>● {status.label}</span>
                      {doc.status === 'READY' && <span>{doc.pageCount} pages · {doc.chunkCount} chunks</span>}
                      {doc.fileSize ? <span>{formatSize(doc.fileSize)}</span> : null}
                    </div>
                    {doc.status === 'FAILED' && doc.error && (
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--accent-red, #e5484d)' }}>{doc.error}</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Chat panel ── */}
        <section
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {!selectedDoc ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)', padding: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
              Select or upload a PDF to start chatting.
            </div>
          ) : (
            <>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedDoc.fileName}
                </div>
                <span style={{ fontSize: 12, color: STATUS_STYLES[selectedDoc.status].color, fontWeight: 600 }}>
                  ● {STATUS_STYLES[selectedDoc.status].label}
                </span>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {selectedDoc.status === 'PROCESSING' && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', margin: 'auto' }}>
                    Indexing your document… this can take a moment for large PDFs.
                  </div>
                )}
                {selectedDoc.status === 'READY' && messages.length === 0 && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', margin: 'auto' }}>
                    Ask anything about this document, e.g. “Summarize the key points” or “What methodology was used?”
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3, textAlign: m.role === 'user' ? 'right' : 'left' }}>
                      {m.role === 'user' ? 'You' : 'MeetScribe AI'}
                    </div>
                    <div className={m.role === 'user' ? 'msg--self' : 'msg--other'} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {m.message}
                    </div>
                    {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {m.sources
                          .filter((s) => s.page != null)
                          .map((s, i) => (
                            <span
                              key={i}
                              title={`similarity ${(s.similarity * 100).toFixed(0)}%`}
                              style={{
                                fontSize: 11,
                                background: 'var(--bg-card-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-pill)',
                                padding: '2px 10px',
                                color: 'var(--accent-blue)',
                              }}
                            >
                              page {s.page}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
                {asking && (
                  <div style={{ alignSelf: 'flex-start', color: 'var(--text-secondary)', fontSize: 13 }}>
                    MeetScribe AI is thinking…
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleAsk} style={{ padding: 14, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={selectedDoc.status === 'READY' ? 'Ask a question about this PDF…' : 'Document is still processing…'}
                  disabled={selectedDoc.status !== 'READY' || asking}
                  style={{
                    flex: 1,
                    background: 'var(--bg-card-secondary)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    borderRadius: 'var(--radius-pill)',
                    padding: '10px 16px',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={selectedDoc.status !== 'READY' || asking || !question.trim()}
                  style={{
                    background: 'var(--accent-blue)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 42,
                    height: 42,
                    color: '#fff',
                    cursor: 'pointer',
                    opacity: selectedDoc.status !== 'READY' || asking || !question.trim() ? 0.5 : 1,
                  }}
                >
                  ➤
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
};

export default MeetScribeAI;
