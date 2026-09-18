import React, { useEffect, useState } from 'react';
import api from '../../api/client';

export const AdminCalls: React.FC = () => {
  const [calls, setCalls] = useState<any[]>([]);

  useEffect(() => {
    const loadCalls = async () => {
      try {
        const res = await api.get('/admin/calls');
        setCalls(res.data.data.calls);
      } catch (err) {
        console.error(err);
      }
    };
    loadCalls();
  }, []);

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <span>LiveKit Video Call Sessions ({calls.length})</span>
      </div>

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Room Identifier</th>
              <th>Caller</th>
              <th>Receiver</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Recording</th>
              <th>Transcription</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {calls.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.roomName}</td>
                <td>{c.caller?.name}</td>
                <td>{c.receiver?.name}</td>
                <td>
                  <span className={`badge-status ${c.status === 'ACTIVE' ? 'active' : c.status === 'TERMINATED_LOW_BALANCE' ? 'suspended' : 'pending'}`}>
                    {c.status}
                  </span>
                </td>
                <td>{c.durationSeconds}s</td>
                <td>{c.recordingEnabled ? '🔴 Active' : 'Off'}</td>
                <td>{c.transcriptionEnabled ? '🎙 Active' : 'Off'}</td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {new Date(c.createdAt).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};