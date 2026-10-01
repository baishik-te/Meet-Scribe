import React, { useCallback, useEffect, useState } from 'react';
import api, { API_BASE_URL } from '../api/client';
import { AppShell } from '../components/AppShell';
import { InlineNotice } from '../components/InlineNotice';

// ── Types mirroring the backend media endpoints ──────────────────────────────
interface RecordingVM {
  id: string;
  name: string | null;
  storageUrl: string | null;
  durationSeconds: number;
  startedAt: string | null;
  createdAt: string;
  call?: { id: string; roomName: string; startedAt: string | null };
}

interface TranscriptionSessionVM {
  callId: string;
  roomName: string;
  startedAt: string | null;
  durationSeconds: number;
  caller?: { id: string; name: string };
  receiver?: { id: string; name: string };
  transcriptCount: number;
  hasSummary: boolean;
}

interface TranscriptLineVM {
  id: string;
  text: string;
  createdAt: string;
  speaker?: { id: string; name: string };
}

// ── Formatting helpers ───────────────────────────────────────────────────────
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} sec`;
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin ? `${hours} hr ${remMin} min` : `${hours} hr`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-lg)',
  padding: 20,
};

// ── Recordings tab ────────────────────────────────────────────────────────────
const RecordingsTab: React.FC = () => {
  const [recordings, setRecordings] = useState<RecordingVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/user/recordings');
      setRecordings(res.data.data.recordings);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load recordings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startRename = (rec: RecordingVM) => {
    setEditingId(rec.id);
    setEditValue(rec.name || '');
  };

  const saveRename = async (rec: RecordingVM) => {
    const name = editValue.trim();
    if (!name) return;
    try {
      const res = await api.patch(`/user/recordings/${rec.id}`, { name });
      setRecordings((prev) => prev.map((r) => (r.id === rec.id ? res.data.data.recording : r)));
      setEditingId(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Could not rename the recording.');
    }
  };

  const getStreamUrl = (id: string) => {
    const token = localStorage.getItem('token') || '';
    return `${API_BASE_URL}/user/recordings/${id}/file?token=${encodeURIComponent(token)}`;
  };

  const getDownloadUrl = (id: string) => {
    const token = localStorage.getItem('token') || '';
    return `${API_BASE_URL}/user/recordings/${id}/file?token=${encodeURIComponent(token)}&download=1`;
  };

  const togglePlay = (rec: RecordingVM) => {
    if (playingId === rec.id) {
      setPlayingId(null);
    } else {
      setError(null);
      setPlayingId(rec.id);
    }
  };

  const download = (rec: RecordingVM) => {
    try {
      setDownloadingId(rec.id);
      const filename = `${(rec.name || 'recording').replace(/[^\w.-]+/g, '_')}.webm`;
      const url = getDownloadUrl(rec.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      setError('Could not download the recording.');
    } finally {
      setTimeout(() => setDownloadingId(null), 1200);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Loading recordings…</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InlineNotice message={error} variant="error" onDismiss={() => setError(null)} />

      {recordings.length === 0 ? (
        <div style={{ ...cardStyle, color: 'var(--text-secondary)' }}>
          No recordings yet. Start a recording during a call (the ⏺ button) and it will appear here.
        </div>
      ) : (
        recordings.map((rec) => (
          <div key={rec.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                {editingId === rec.id ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      aria-label="Recording name"
                      autoFocus
                      style={{
                        flex: 1,
                        background: 'var(--bg-card-secondary)',
                        border: '1px solid var(--border-color)',
                        color: '#fff',
                        borderRadius: 'var(--radius-md)',
                        padding: '8px 12px',
                        minWidth: 140,
                      }}
                    />
                    <button type="button" onClick={() => saveRename(rec)} style={btnPrimary}>Save</button>
                    <button type="button" onClick={() => setEditingId(null)} style={btnGhost}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {rec.name || 'Untitled recording'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => startRename(rec)}
                      aria-label="Rename recording"
                      title="Rename"
                      style={{ ...btnGhost, padding: '4px 8px' }}
                    >
                      ✏️
                    </button>
                  </div>
                )}
                <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span>🗓 {formatDate(rec.startedAt || rec.createdAt)}</span>
                  <span>⏱ {formatDuration(rec.durationSeconds)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => togglePlay(rec)}
                  style={playingId === rec.id ? btnActive : btnPrimary}
                >
                  {playingId === rec.id ? '⏹ Close Player' : '▶ Play'}
                </button>
                <button
                  type="button"
                  onClick={() => download(rec)}
                  disabled={downloadingId === rec.id}
                  style={{ ...btnGhost, opacity: downloadingId === rec.id ? 0.7 : 1 }}
                >
                  {downloadingId === rec.id ? '⬇ Downloading…' : '⬇ Download'}
                </button>
              </div>
            </div>

            {playingId === rec.id && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Streaming: <strong style={{ color: '#fff' }}>{rec.name || 'Untitled recording'}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPlayingId(null)}
                    style={{ ...btnGhost, padding: '4px 10px', fontSize: 12 }}
                  >
                    ✕ Close
                  </button>
                </div>
                <video
                  key={rec.id}
                  src={getStreamUrl(rec.id)}
                  controls
                  autoPlay
                  playsInline
                  onError={() => {
                    setError('Could not stream recording. Try downloading the file instead.');
                  }}
                  style={{ width: '100%', borderRadius: 'var(--radius-md)', background: '#000', maxHeight: 480 }}
                />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

// ── Transcriptions tab ────────────────────────────────────────────────────────
const TranscriptionsTab: React.FC = () => {
  const [sessions, setSessions] = useState<TranscriptionSessionVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCallId, setOpenCallId] = useState<string | null>(null);
  const [lines, setLines] = useState<TranscriptLineVM[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/user/transcriptions');
      setSessions(res.data.data.sessions);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load transcriptions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openSession = async (session: TranscriptionSessionVM) => {
    if (openCallId === session.callId) {
      setOpenCallId(null);
      return;
    }
    setOpenCallId(session.callId);
    setLines([]);
    setSummary(null);
    setLinesLoading(true);
    try {
      const [transcriptsRes, summaryRes] = await Promise.all([
        api.get(`/user/calls/${session.callId}/transcripts`),
        api.get(`/user/calls/${session.callId}/summary`),
      ]);
      setLines(transcriptsRes.data.data.transcripts);
      setSummary(summaryRes.data.data.summary?.content ?? null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load the transcript.');
    } finally {
      setLinesLoading(false);
    }
  };

  const generateSummary = async (callId: string) => {
    try {
      setSummarizing(true);
      setError(null);
      const res = await api.post(`/user/calls/${callId}/summary`);
      setSummary(res.data.data.summary.content);
      setSessions((prev) => prev.map((s) => (s.callId === callId ? { ...s, hasSummary: true } : s)));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Could not generate a summary.');
    } finally {
      setSummarizing(false);
    }
  };

  const sessionTitle = (s: TranscriptionSessionVM) => {
    const names = [s.caller?.name, s.receiver?.name].filter(Boolean).join(' & ');
    return names || s.roomName;
  };

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Loading transcriptions…</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InlineNotice message={error} variant="error" onDismiss={() => setError(null)} />

      {sessions.length === 0 ? (
        <div style={{ ...cardStyle, color: 'var(--text-secondary)' }}>
          No transcriptions yet. Turn on live transcription (the 🎙 toggle) during a call to build one.
        </div>
      ) : (
        sessions.map((s) => (
          <div key={s.callId} style={cardStyle}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => openSession(s)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openSession(s)}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 16, cursor: 'pointer', flexWrap: 'wrap' }}
            >
              <div>
                <h3 style={{ margin: 0 }}>{sessionTitle(s)}</h3>
                <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span>🗓 {formatDate(s.startedAt)}</span>
                  <span>💬 {s.transcriptCount} lines</span>
                  {s.hasSummary && <span style={{ color: 'var(--accent-blue)' }}>✦ Summary available</span>}
                </div>
              </div>
              <span style={{ color: 'var(--text-secondary)' }}>{openCallId === s.callId ? '▲' : '▼'}</span>
            </div>

            {openCallId === s.callId && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => generateSummary(s.callId)}
                    disabled={summarizing}
                    style={{ ...btnPrimary, opacity: summarizing ? 0.7 : 1 }}
                  >
                    {summarizing ? 'Generating…' : summary ? '↻ Regenerate summary' : '✦ Generate summary'}
                  </button>
                </div>

                {summary && (
                  <div
                    style={{
                      background: 'var(--bg-card-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: 16,
                      marginBottom: 16,
                      whiteSpace: 'pre-wrap',
                      fontSize: 14,
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Summary</div>
                    {summary}
                  </div>
                )}

                {linesLoading ? (
                  <p style={{ color: 'var(--text-secondary)' }}>Loading transcript…</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
                    {lines.map((line) => (
                      <div key={line.id}>
                        <div style={{ fontSize: 12, color: 'var(--accent-blue)', marginBottom: 2 }}>
                          {line.speaker?.name || 'Speaker'}
                        </div>
                        <div style={{ fontSize: 14 }}>{line.text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

const btnPrimary: React.CSSProperties = {
  background: 'var(--accent-blue)',
  border: 'none',
  color: '#fff',
  padding: '8px 16px',
  borderRadius: 'var(--radius-pill)',
  cursor: 'pointer',
  fontWeight: 600,
};

const btnGhost: React.CSSProperties = {
  background: 'var(--bg-card-secondary)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-primary)',
  padding: '8px 16px',
  borderRadius: 'var(--radius-pill)',
  cursor: 'pointer',
};

const btnActive: React.CSSProperties = {
  background: 'rgba(59, 130, 246, 0.2)',
  border: '1px solid var(--accent-blue)',
  color: '#60a5fa',
  padding: '8px 16px',
  borderRadius: 'var(--radius-pill)',
  cursor: 'pointer',
  fontWeight: 600,
};

// ── Page ──────────────────────────────────────────────────────────────────────
export const Library: React.FC = () => {
  const [tab, setTab] = useState<'recordings' | 'transcriptions'>('recordings');

  const tabButton = (key: 'recordings' | 'transcriptions', label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      style={{
        background: tab === key ? 'var(--accent-blue)' : 'transparent',
        color: tab === key ? '#fff' : 'var(--text-secondary)',
        border: tab === key ? 'none' : '1px solid var(--border-color)',
        padding: '8px 18px',
        borderRadius: 'var(--radius-pill)',
        cursor: 'pointer',
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );

  return (
    <AppShell title="Library">
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
        Your saved call recordings and live transcriptions. Generate AI summaries from any transcript.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {tabButton('recordings', '🎥 Recordings')}
        {tabButton('transcriptions', '📝 Transcriptions')}
      </div>

      {tab === 'recordings' ? <RecordingsTab /> : <TranscriptionsTab />}
    </AppShell>
  );
};

export default Library;
