import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { AppShell } from '../components/AppShell';
import { InlineNotice } from '../components/InlineNotice';
import '../styles/MeetScribeAI.css';

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

const STATUS_STYLES: Record<
  DocumentVM['status'],
  { label: string; color: string }
> = {
  PROCESSING: {
    label: 'Processing',
    color: 'var(--accent-blue)',
  },
  READY: {
    label: 'Ready',
    color: '#22c55e',
  },
  FAILED: {
    label: 'Failed',
    color: 'var(--accent-red, #e5484d)',
  },
};

const FileIcon = () => (
  <svg
    width="19"
    height="19"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8" />
    <path d="M8 17h6" />
  </svg>
);

const UploadIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 16V4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M5 20h14" />
  </svg>
);

const SendIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M22 2L11 13" />
    <path d="M22 2l-7 20-4-9-9-4z" />
  </svg>
);

const TrashIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 15H6L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

const SparkleIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3l1.4 4.2L17 9l-3.6 1.8L12 15l-1.4-4.2L7 9l3.6-1.8z" />
    <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" />
  </svg>
);

const formatSize = (bytes: number | null): string => {
  if (!bytes) return '';

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  const selectedDoc =
    documents.find((document) => document.id === selectedId) || null;

  const loadDocuments = useCallback(async () => {
    try {
      const res = await api.get('/user/pdf');
      setDocuments(res.data.data.documents);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          'Failed to load your documents.'
      );
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const anyProcessing = documents.some(
      (document) => document.status === 'PROCESSING'
    );

    if (!anyProcessing) return;

    const timer = setInterval(loadDocuments, 2500);

    return () => clearInterval(timer);
  }, [documents, loadDocuments]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await api.get(
          `/user/pdf/${selectedId}/messages`
        );

        if (!cancelled) {
          setMessages(res.data.data.messages);
        }
      } catch {
        if (!cancelled) {
          setMessages([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages]);

  const handleUpload = async (file: File) => {
    setError(null);
    setUploading(true);

    try {
      const form = new FormData();

      form.append('pdf', file);

      const res = await api.post(
        '/user/pdf/upload',
        form,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const doc: DocumentVM =
        res.data.data.document;

      setDocuments((prev) => [doc, ...prev]);
      setSelectedId(doc.id);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          'Upload failed.'
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/user/pdf/${id}`);

      setDocuments((prev) =>
        prev.filter((doc) => doc.id !== id)
      );

      if (selectedId === id) {
        setSelectedId(null);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          'Could not delete the document.'
      );
    }
  };

  const handleAsk = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const q = question.trim();

    if (
      !q ||
      !selectedDoc ||
      selectedDoc.status !== 'READY' ||
      asking
    ) {
      return;
    }

    setQuestion('');
    setAsking(true);
    setError(null);

    const tempId = `tmp-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: 'user',
        message: q,
      },
    ]);

    try {
      const res = await api.post(
        `/user/pdf/${selectedDoc.id}/chat`,
        {
          question: q,
        }
      );

      const {
        answer,
        sources,
        messageId,
      } = res.data.data;

      setMessages((prev) => [
        ...prev,
        {
          id:
            messageId ||
            `a-${Date.now()}`,
          role: 'assistant',
          message: answer,
          sources,
        },
      ]);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          'Could not get an answer.'
      );
    } finally {
      setAsking(false);
    }
  };

  const handleSuggestion = (text: string) => {
    if (
      !selectedDoc ||
      selectedDoc.status !== 'READY' ||
      asking
    ) {
      return;
    }

    setQuestion(text);
  };

  const readyCount = documents.filter(
    (doc) => doc.status === 'READY'
  ).length;

  return (
    <AppShell title="MeetScribe AI">
      <div className="pdf-workspace">

        {/* =========================
            Page Header
        ========================= */}

        <header className="pdf-header">
          <div>
            <div className="pdf-eyebrow">
              <span className="pdf-eyebrow-dot" />
              AI PDF WORKSPACE
            </div>

            <h1>Understand your documents.</h1>

            <p>
              Ask questions, summarize content, and explore
              your PDFs with grounded answers and page
              citations.
            </p>
          </div>

          <div className="library-summary">
            <div className="summary-value">
              {documents.length}
            </div>

            <div>
              <span>Documents</span>
              <small>
                {readyCount} ready to chat
              </small>
            </div>
          </div>
        </header>

        <InlineNotice
          message={error}
          variant="error"
          onDismiss={() => setError(null)}
        />

        {/* =========================
            Workspace
        ========================= */}

        <div className="pdf-layout">

          {/* =========================
              Documents Panel
          ========================= */}

          <aside className="documents-panel">

            <div className="documents-panel-header">

              <div>
                <span className="panel-label">
                  DOCUMENT LIBRARY
                </span>

                <h2>Your PDFs</h2>
              </div>

              <span className="document-count">
                {documents.length}
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              hidden
              onChange={(e) => {
                const file =
                  e.target.files?.[0];

                if (file) {
                  handleUpload(file);
                }
              }}
            />

            <button
              type="button"
              className="upload-button"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={uploading}
            >
              <UploadIcon />

              {uploading
                ? 'Uploading…'
                : 'Upload PDF'}
            </button>

            <div className="upload-hint">
              PDF files only
            </div>

            <div className="documents-divider" />

            <div className="documents-list">

              {documents.length === 0 ? (
                <div className="documents-empty">
                  <div className="documents-empty-icon">
                    <FileIcon />
                  </div>

                  <h3>No documents yet</h3>

                  <p>
                    Upload your first PDF to start
                    asking questions.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                  >
                    Upload your first PDF
                  </button>
                </div>
              ) : (
                documents.map((doc) => {
                  const status =
                    STATUS_STYLES[doc.status];

                  const active =
                    doc.id === selectedId;

                  return (
                    <article
                      key={doc.id}
                      className={`document-card ${
                        active
                          ? 'document-card--active'
                          : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="document-select"
                        onClick={() =>
                          setSelectedId(doc.id)
                        }
                      >
                        <div className="document-icon">
                          <FileIcon />
                        </div>

                        <div className="document-main">
                          <div className="document-title">
                            {doc.fileName}
                          </div>

                          <div className="document-meta">
                            <span
                              style={{
                                color: status.color,
                              }}
                            >
                              <span className="status-dot" />
                              {status.label}
                            </span>

                            {doc.status === 'READY' && (
                              <span>
                                {doc.pageCount} pages
                              </span>
                            )}

                            {doc.fileSize ? (
                              <span>
                                {formatSize(
                                  doc.fileSize
                                )}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        className="delete-document"
                        onClick={() =>
                          handleDelete(doc.id)
                        }
                        aria-label={`Delete ${doc.fileName}`}
                        title="Delete document"
                      >
                        <TrashIcon />
                      </button>

                      {doc.status === 'FAILED' &&
                        doc.error && (
                          <div className="document-error">
                            {doc.error}
                          </div>
                        )}
                    </article>
                  );
                })
              )}
            </div>
          </aside>

          {/* =========================
              Chat Panel
          ========================= */}

          <section className="chat-panel">

            {!selectedDoc ? (
              <div className="chat-welcome">

                <div className="welcome-icon">
                  <SparkleIcon />
                </div>

                <span className="chat-eyebrow">
                  MEETSCRIBE AI
                </span>

                <h2>
                  Start with a document
                </h2>

                <p>
                  Select a PDF from your library or
                  upload a new one to begin a grounded
                  conversation.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                >
                  <UploadIcon />
                  Upload PDF
                </button>

              </div>
            ) : (
              <>
                {/* Chat Header */}

                <div className="chat-header">

                  <div className="chat-document">

                    <div className="chat-document-icon">
                      <FileIcon />
                    </div>

                    <div>
                      <div className="chat-document-name">
                        {selectedDoc.fileName}
                      </div>

                      <div className="chat-document-meta">
                        {selectedDoc.status ===
                        'READY'
                          ? `${selectedDoc.pageCount} pages · ${selectedDoc.chunkCount} chunks`
                          : STATUS_STYLES[
                              selectedDoc.status
                            ].label}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`chat-status chat-status--${selectedDoc.status.toLowerCase()}`}
                  >
                    <span />
                    {
                      STATUS_STYLES[
                        selectedDoc.status
                      ].label
                    }
                  </div>
                </div>

                {/* Messages */}

                <div className="messages-area">

                  {selectedDoc.status ===
                    'PROCESSING' && (
                    <div className="processing-state">
                      <div className="loading-orb">
                        <SparkleIcon />
                      </div>

                      <h3>
                        Preparing your document
                      </h3>

                      <p>
                        We're indexing your PDF so
                        MeetScribe AI can answer with
                        page-level context.
                      </p>

                      <div className="processing-bar">
                        <span />
                      </div>
                    </div>
                  )}

                  {selectedDoc.status === 'FAILED' && (
                    <div className="processing-state processing-state--error">
                      <div className="loading-orb">
                        <FileIcon />
                      </div>

                      <h3>
                        Document processing failed
                      </h3>

                      <p>
                        {selectedDoc.error ||
                          'This document could not be processed.'}
                      </p>
                    </div>
                  )}

                  {selectedDoc.status === 'READY' &&
                    messages.length === 0 && (
                      <div className="chat-empty">

                        <div className="ai-avatar">
                          <SparkleIcon />
                        </div>

                        <span className="chat-eyebrow">
                          MEETSCRIBE AI
                        </span>

                        <h3>
                          Ask anything about your PDF
                        </h3>

                        <p>
                          Your answers are grounded in
                          the selected document and can
                          reference the relevant pages.
                        </p>

                        <div className="suggestion-grid">

                          <button
                            type="button"
                            onClick={() =>
                              handleSuggestion(
                                'Summarize the key points of this document.'
                              )
                            }
                          >
                            Summarize the key points
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleSuggestion(
                                'What methodology was used in this document?'
                              )
                            }
                          >
                            Explain the methodology
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleSuggestion(
                                'What are the most important findings?'
                              )
                            }
                          >
                            Find the main findings
                          </button>

                        </div>
                      </div>
                    )}

                  <div className="message-stack">

                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`message-row ${
                          message.role === 'user'
                            ? 'message-row--user'
                            : 'message-row--assistant'
                        }`}
                      >
                        {message.role ===
                          'assistant' && (
                          <div className="message-avatar">
                            <SparkleIcon />
                          </div>
                        )}

                        <div className="message-content">

                          <div className="message-author">
                            {message.role ===
                            'user'
                              ? 'You'
                              : 'MeetScribe AI'}
                          </div>

                          <div
                            className={
                              message.role ===
                              'user'
                                ? 'message-bubble message-bubble--user'
                                : 'message-bubble message-bubble--assistant'
                            }
                          >
                            {message.message}
                          </div>

                          {message.role ===
                            'assistant' &&
                            message.sources &&
                            message.sources.length >
                              0 && (
                              <div className="sources">
                                <span className="sources-label">
                                  SOURCES
                                </span>

                                <div className="source-list">
                                  {message.sources
                                    .filter(
                                      (source) =>
                                        source.page !=
                                        null
                                    )
                                    .map(
                                      (
                                        source,
                                        index
                                      ) => (
                                        <span
                                          key={`${message.id}-${index}`}
                                          className="source-chip"
                                          title={`Similarity ${(source.similarity * 100).toFixed(
                                            0
                                          )}%`}
                                        >
                                          Page{' '}
                                          {source.page}
                                        </span>
                                      )
                                    )}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>
                    ))}

                    {asking && (
                      <div className="message-row message-row--assistant">
                        <div className="message-avatar">
                          <SparkleIcon />
                        </div>

                        <div className="message-content">
                          <div className="message-author">
                            MeetScribe AI
                          </div>

                          <div className="typing-bubble">
                            <span />
                            <span />
                            <span />
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Composer */}

                <form
                  className="chat-composer"
                  onSubmit={handleAsk}
                >
                  <div className="composer-inner">

                    <label
                      htmlFor="pdf-question"
                      className="sr-only"
                    >
                      Ask a question about the PDF
                    </label>

                    <input
                      id="pdf-question"
                      type="text"
                      value={question}
                      onChange={(e) =>
                        setQuestion(
                          e.target.value
                        )
                      }
                      placeholder={
                        selectedDoc.status ===
                        'READY'
                          ? 'Ask a question about this document…'
                          : 'Document is still processing…'
                      }
                      disabled={
                        selectedDoc.status !==
                          'READY' || asking
                      }
                    />

                    <button
                      type="submit"
                      disabled={
                        selectedDoc.status !==
                          'READY' ||
                        asking ||
                        !question.trim()
                      }
                      aria-label="Send question"
                    >
                      <SendIcon />
                    </button>
                  </div>

                  <div className="composer-footer">
                    <span>
                      Answers are grounded in your
                      selected document.
                    </span>

                    <span>
                      Enter to send
                    </span>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
};

export default MeetScribeAI;