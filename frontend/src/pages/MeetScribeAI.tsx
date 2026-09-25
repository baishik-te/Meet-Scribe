import React, { useCallback, useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import api from '../api/client';
import { AppShell } from '../components/AppShell';
import { InlineNotice } from '../components/InlineNotice';
import { MarkdownMessage } from '../components/MarkdownMessage';
import '../styles/MeetScribeAI.css';

interface DocumentVM {
  id: string;
  fileName: string;
  sessionId?: string;
  status: 'PROCESSING' | 'READY' | 'FAILED';
  pageCount: number;
  chunkCount: number;
  fileSize: number | null;
  error: string | null;
  createdAt: string;
}

interface SourceVM {
  page: number | null;
  fileName?: string | null;
  similarity: number;
}

interface AttachmentVM {
  documentId?: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  previewUrl?: string | null;
}

interface StagedFileVM {
  id: string;
  file: File;
  previewUrl: string | null;
}

interface ChatMsgVM {
  id: string;
  role: 'user' | 'assistant';
  message: string;
  attachments?: AttachmentVM[] | null;
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

const PlusIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 5v14" />
    <path d="M5 12h14" />
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
  const [stagedFiles, setStagedFiles] = useState<StagedFileVM[]>([]);
  const [question, setQuestion] = useState('');
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const stagedFilesRef = useRef<StagedFileVM[]>([]);
  const retainedPreviewUrlsRef = useRef<string[]>([]);
  // Determines whether the next file selection starts a new session upload or
  // is staged for the active chat composer.
  const filePickerModeRef = useRef<'new' | 'stage'>('new');

  const selectedDoc =
    documents.find((document) => document.id === selectedId) || null;
  const activeSessionId = selectedDoc?.sessionId || selectedDoc?.id || null;
  const sessionDocuments = activeSessionId
    ? documents.filter(
        (document) =>
          (document.sessionId || document.id) === activeSessionId
      )
    : [];
  const sessionReady = sessionDocuments.some(
    (document) => document.status === 'READY'
  );
  const activeChatStatus: DocumentVM['status'] = sessionReady
    ? 'READY'
    : selectedDoc?.status || 'PROCESSING';

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

  const stageFiles = (files: File[]) => {
    const staged = files.map((file, index) => ({
      id: `staged-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : null,
    }));

    setStagedFiles((current) => [...current, ...staged]);
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  const clearStagedFiles = (revokePreviews = true) => {
    if (revokePreviews) {
      stagedFilesRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    }
    stagedFilesRef.current = [];
    setStagedFiles([]);
  };

  useEffect(() => {
    stagedFilesRef.current = stagedFiles;
  }, [stagedFiles]);

  useEffect(() => {
    return () => {
      stagedFilesRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      retainedPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    clearStagedFiles();
  }, [selectedId]);

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

      const doc: DocumentVM = res.data.data.document;
      setDocuments((prev) => [
        doc,
        ...prev.filter((existing) => existing.id !== doc.id),
      ]);
      setSelectedId(res.data.data.sessionId || doc.id);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          'Upload failed.'
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openNewFilePicker = () => {
    filePickerModeRef.current = 'new';
    fileInputRef.current?.click();
  };

  const openMergeFilePicker = () => {
    if (!activeSessionId) return;
    filePickerModeRef.current = 'stage';
    fileInputRef.current?.click();
  };

  const handleDelete = async (id: string) => {
    const documentToDelete = documents.find((doc) => doc.id === id);

    try {
      await api.delete(`/user/pdf/${id}`);

      setDocuments((prev) =>
        prev.filter((doc) => doc.id !== id)
      );

      if (documentToDelete) {
        const documentSessionId =
          documentToDelete.sessionId || documentToDelete.id;
        const isAnchor = documentSessionId === documentToDelete.id;

        if (isAnchor && activeSessionId === documentSessionId) {
          setSelectedId(null);
        } else if (!isAnchor && selectedId === id) {
          // Removing a supplementary file must not close the active session.
          setSelectedId(documentSessionId);
        }
      } else if (selectedId === id) {
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
    const filesToSend = [...stagedFiles];

    if (
      !q ||
      !selectedDoc ||
      !sessionReady ||
      asking
    ) {
      return;
    }

    setQuestion('');
    setAsking(true);
    setError(null);

    const tempId = `tmp-${Date.now()}`;
    const optimisticAttachments: AttachmentVM[] = filesToSend.map((item) => ({
      fileName: item.file.name,
      mimeType: item.file.type || 'application/octet-stream',
      fileSize: item.file.size,
      previewUrl: item.previewUrl,
    }));

    // Optimistically render the user's question and staged files immediately.
    // Keep image object URLs alive for the rendered message after clearing the
    // composer preview.
    retainedPreviewUrlsRef.current.push(
      ...filesToSend
        .map((item) => item.previewUrl)
        .filter((url): url is string => Boolean(url))
    );
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: 'user',
        message: q,
        attachments: optimisticAttachments.length
          ? optimisticAttachments
          : null,
      },
    ]);
    clearStagedFiles(false);

    try {
      let payload: FormData | { question: string } = { question: q };
      let requestConfig: { headers?: Record<string, string> } | undefined;

      if (filesToSend.length > 0) {
        const form = new FormData();
        form.append('question', q);
        if (activeSessionId) {
          form.append('activeDocumentId', activeSessionId);
        }
        filesToSend.forEach((item) => {
          form.append('attachments', item.file, item.file.name);
        });
        payload = form;
        requestConfig = {
          headers: { 'Content-Type': 'multipart/form-data' },
        };
      }

      const res = await api.post(
        `/user/pdf/${selectedDoc.id}/chat`,
        payload,
        requestConfig
      );

      // The backend masks AI/API failures as a 200 with success:false and a
      // safe message. Surface that message and keep raw errors out of the UI.
      if (!res.data?.success || !res.data?.data) {
        setError(
          res.data?.error?.message ||
            'Something went wrong, please try again'
        );
        return;
      }

      const {
        answer,
        sources,
        messageId,
      } = res.data.data;

      setMessages((prev) => [
        ...prev,
        {
          id: messageId || `a-${Date.now()}`,
          role: 'assistant',
          message: answer,
          sources,
        },
      ]);

      if (filesToSend.length > 0) {
        // Refresh only from the filtered library endpoint. Chat-only rows are
        // excluded server-side, so this cannot append them to Your Documents
        // and also removes legacy rows after the compatibility migration.
        await loadDocuments();
      }

      // Chat attachments remain local to this session/message and are not
      // appended to the global document library.
      return;
    } catch {
      // Never expose raw API errors, JSON bodies, or status codes.
      setError('Something went wrong, please try again');
    } finally {
      setAsking(false);
    }
  };

  // Enter submits; Shift+Enter inserts a newline.
  const handleComposerKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk(e);
    }
    // Shift+Enter: fall through to default behavior (newline).
  };

  const handleSuggestion = (text: string) => {
    if (
      !selectedDoc ||
      !sessionReady ||
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
              AI DOCUMENT WORKSPACE
            </div>

            <h1>Understand your documents.</h1>

            <p>
              Ask questions, summarize content, and explore
              your documents with grounded answers and page
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

                <h2>Your Documents</h2>
              </div>

              <span className="document-count">
                {documents.length}
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.docx,.xlsx,image/png,image/jpeg,image/jpg"
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                const mode = filePickerModeRef.current;
                filePickerModeRef.current = 'new';
                e.target.value = '';

                if (mode === 'stage') {
                  stageFiles(files);
                } else if (files[0]) {
                  handleUpload(files[0]);
                }
              }}
            />

            <button
              type="button"
              className="upload-button"
              onClick={openNewFilePicker}
              disabled={uploading}
            >
              <UploadIcon />

              {uploading
                ? 'Uploading…'
                : 'Upload File'}
            </button>

            <div className="upload-hint">
              PDF, TXT, DOCX, XLSX, PNG, JPG
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
                    Upload your first file to start
                    asking questions.
                  </p>

                  <button
                    type="button"
                    onClick={openNewFilePicker}
                  >
                    Upload your first file
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

                            {doc.sessionId &&
                              doc.sessionId !== doc.id && (
                                <span className="document-session-label">
                                  In active chat
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
                  Select a document from your library or
                  upload a new one to begin a grounded
                  conversation.
                </p>

                <button
                  type="button"
                  onClick={openNewFilePicker}
                >
                  <UploadIcon />
                  Upload File
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
                    {sessionDocuments.length > 1
                      ? `${sessionDocuments.length} files in this chat · ${sessionDocuments.reduce((total, document) => total + (document.chunkCount || 0), 0)} chunks`
                      : selectedDoc.status === 'READY'
                        ? `${selectedDoc.pageCount} pages · ${selectedDoc.chunkCount} chunks`
                        : STATUS_STYLES[selectedDoc.status].label}
                  </div>
                    </div>
                  </div>

                  <div
                    className={`chat-status chat-status--${activeChatStatus.toLowerCase()}`}
                  >
                    <span />
                    {STATUS_STYLES[activeChatStatus].label}
                  </div>
                </div>

                {/* Messages */}

                <div className="messages-area">

                  {!sessionReady && (
                    <div className="processing-state">
                      <div className="loading-orb">
                        <SparkleIcon />
                      </div>

                      <h3>
                        Preparing your document
                      </h3>

                              <p>
                                We're indexing the files in this chat so
                                MeetScribe AI can answer with
                                page-level context.
                              </p>

                      <div className="processing-bar">
                        <span />
                      </div>
                    </div>
                  )}

                  {selectedDoc.status === 'FAILED' && !sessionReady && (
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

                  {sessionReady &&
                    messages.length === 0 && (
                      <div className="chat-empty">

                        <div className="ai-avatar">
                          <SparkleIcon />
                        </div>

                        <span className="chat-eyebrow">
                          MEETSCRIBE AI
                        </span>

                        <h3>
                          Ask anything about your document
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
                            {message.role === 'assistant' ? (
                              <MarkdownMessage content={message.message} />
                            ) : (
                              <>
                                {message.attachments && message.attachments.length > 0 && (
                                  <div className="message-attachments">
                                    {message.attachments.map((attachment, index) => (
                                      <div
                                        className="message-attachment"
                                        key={`${message.id}-attachment-${index}`}
                                      >
                                        <div className="message-attachment-preview">
                                          {attachment.previewUrl && attachment.mimeType.startsWith('image/') ? (
                                            <img src={attachment.previewUrl} alt="" />
                                          ) : (
                                            <FileIcon />
                                          )}
                                        </div>
                                        <span title={attachment.fileName}>
                                          {attachment.fileName}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="message-text">{message.message}</div>
                              </>
                            )}
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
                                          title={`${source.fileName ? `${source.fileName} · ` : ''}Similarity ${(source.similarity * 100).toFixed(
                                            0
                                          )}%`}
                                        >
                                          {source.fileName ? `${source.fileName} · ` : ''}
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
                  {stagedFiles.length > 0 && (
                    <div
                      className="staged-attachments"
                      aria-label="Files staged for this message"
                    >
                      {stagedFiles.map((item) => (
                        <div
                          className="staged-attachment"
                          key={item.id}
                        >
                          <div className="staged-attachment-preview">
                            {item.previewUrl ? (
                              <img
                                src={item.previewUrl}
                                alt=""
                              />
                            ) : (
                              <FileIcon />
                            )}
                          </div>
                          <span
                            className="staged-attachment-name"
                            title={item.file.name}
                          >
                            {item.file.name}
                          </span>
                          <button
                            type="button"
                            className="staged-attachment-remove"
                            onClick={() => removeStagedFile(item.id)}
                            aria-label={`Remove ${item.file.name}`}
                            title="Remove attachment"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="composer-inner">

                    <button
                      type="button"
                      className="composer-attach"
                      onClick={openMergeFilePicker}
                      disabled={uploading}
                      aria-label="Upload a file"
                      title="Upload a file"
                    >
                      <PlusIcon />
                    </button>

                    <label
                      htmlFor="pdf-question"
                      className="sr-only"
                    >
                      Ask a question about the document
                    </label>

                    <TextareaAutosize
                      id="pdf-question"
                      value={question}
                      minRows={1}
                      maxRows={6}
                      onChange={(e) =>
                        setQuestion(
                          e.target.value
                        )
                      }
                      onKeyDown={handleComposerKeyDown}
                      placeholder={
                        sessionReady
                          ? 'Ask a question about these documents…'
                          : 'Documents are still processing…'
                      }
                      disabled={!sessionReady || asking}
                    />

                    <button
                      type="submit"
                      disabled={!sessionReady || asking || !question.trim()}
                      aria-label="Send question"
                    >
                      <SendIcon />
                    </button>
                  </div>

                  <div className="composer-footer">
                    <span>
                      Answers are grounded in your
                      active chat files.
                    </span>

                    <span>
                      Enter to send · Shift+Enter for a new line
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