import React, { useEffect, useState } from 'react';
import api from '../../api/client';

export const AdminPlans: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [newPlan, setNewPlan] = useState({
    name: '',
    price: 15,
    monthlyTokenQuota: 1500,
    videoRatePerMinute: 2,
    recordingRatePerMinute: 1,
    transcriptionRatePerMinute: 1,
    geminiRatePerRequest: 5
  });
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadPlans = async () => {
    try {
      const res = await api.get('/user/plans');
      setPlans(res.data.data.plans);
    } catch (err) {
      console.error('Failed to load plans:', err);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/admin/plans', newPlan);
      alert('Plan registered in PostgreSQL & synchronized with Stripe.');
      setNewPlan({
        name: '',
        price: 15,
        monthlyTokenQuota: 1500,
        videoRatePerMinute: 2,
        recordingRatePerMinute: 1,
        transcriptionRatePerMinute: 1,
        geminiRatePerRequest: 5
      });
      loadPlans();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Plan creation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (plan: any) => {
    setEditingPlan({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      monthlyTokenQuota: plan.monthlyTokenQuota,
      videoRatePerMinute: plan.videoRatePerMinute,
      recordingRatePerMinute: plan.recordingRatePerMinute,
      transcriptionRatePerMinute: plan.transcriptionRatePerMinute,
      geminiRatePerRequest: plan.geminiRatePerRequest
    });
    setShowEditModal(true);
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    setSubmitting(true);
    try {
      await api.patch(`/admin/plans/${editingPlan.id}`, {
        name: editingPlan.name,
        price: editingPlan.price,
        monthlyTokenQuota: editingPlan.monthlyTokenQuota,
        videoRatePerMinute: editingPlan.videoRatePerMinute,
        recordingRatePerMinute: editingPlan.recordingRatePerMinute,
        transcriptionRatePerMinute: editingPlan.transcriptionRatePerMinute,
        geminiRatePerRequest: editingPlan.geminiRatePerRequest
      });
      alert('Plan updated successfully & synchronized with Stripe.');
      setShowEditModal(false);
      setEditingPlan(null);
      loadPlans();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Plan update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    setEditingPlan(null);
  };

  return (
    <div>
      <div className="admin-card">
        <h3 className="admin-card-header">Create Dynamic Rate Plan (Stripe Synchronized)</h3>
        <form onSubmit={handleCreatePlan}>
          <div className="form-grid">
            <div className="form-group">
              <label>Plan Name</label>
              <input
                required
                type="text"
                value={newPlan.name}
                onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                className="dark-input"
                placeholder="e.g. Starter Plan"
              />
            </div>
            <div className="form-group">
              <label>Monthly Price ($)</label>
              <input
                required
                type="number"
                min="1"
                value={newPlan.price}
                onChange={(e) => setNewPlan({ ...newPlan, price: Number(e.target.value) })}
                className="dark-input"
              />
            </div>
            <div className="form-group">
              <label>Monthly Token Quota</label>
              <input
                required
                type="number"
                min="100"
                value={newPlan.monthlyTokenQuota}
                onChange={(e) => setNewPlan({ ...newPlan, monthlyTokenQuota: Number(e.target.value) })}
                className="dark-input"
              />
            </div>
            <div className="form-group">
              <label>Video Rate (tokens/min)</label>
              <input
                required
                type="number"
                value={newPlan.videoRatePerMinute}
                onChange={(e) => setNewPlan({ ...newPlan, videoRatePerMinute: Number(e.target.value) })}
                className="dark-input"
              />
            </div>
            <div className="form-group">
              <label>Recording Rate (tokens/min)</label>
              <input
                required
                type="number"
                value={newPlan.recordingRatePerMinute}
                onChange={(e) => setNewPlan({ ...newPlan, recordingRatePerMinute: Number(e.target.value) })}
                className="dark-input"
              />
            </div>
            <div className="form-group">
              <label>Transcription (tokens/min)</label>
              <input
                required
                type="number"
                value={newPlan.transcriptionRatePerMinute}
                onChange={(e) => setNewPlan({ ...newPlan, transcriptionRatePerMinute: Number(e.target.value) })}
                className="dark-input"
              />
            </div>
            <div className="form-group">
              <label>Gemini AI Rate (tokens/req)</label>
              <input
                required
                type="number"
                value={newPlan.geminiRatePerRequest}
                onChange={(e) => setNewPlan({ ...newPlan, geminiRatePerRequest: Number(e.target.value) })}
                className="dark-input"
              />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="admin-btn">
            {submitting ? 'Registering with Stripe...' : 'Create & Publish Plan'}
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h3 className="admin-card-header">Configured Active Plans</h3>
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Price</th>
                <th>Token Allocation</th>
                <th>Video</th>
                <th>Recording</th>
                <th>Transcription</th>
                <th>Stripe Price ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>${p.price}/mo</td>
                  <td style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                    {p.monthlyTokenQuota?.toLocaleString()}
                  </td>
                  <td>{p.videoRatePerMinute} t/m</td>
                  <td>+{p.recordingRatePerMinute} t/m</td>
                  <td>+{p.transcriptionRatePerMinute} t/m</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.stripePriceId}</td>
                  <td>
                    <button 
                      onClick={() => handleEditClick(p)}
                      className="admin-btn-small"
                      style={{ padding: '4px 12px', fontSize: '13px' }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Plan Modal */}
      {showEditModal && editingPlan && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Plan</h3>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            <form onSubmit={handleUpdatePlan}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Plan Name</label>
                  <input
                    required
                    type="text"
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    className="dark-input"
                  />
                </div>
                <div className="form-group">
                  <label>Monthly Price ($)</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={editingPlan.price}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })}
                    className="dark-input"
                  />
                  <small style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                    Note: Changing price creates a new Stripe price
                  </small>
                </div>
                <div className="form-group">
                  <label>Monthly Token Quota</label>
                  <input
                    required
                    type="number"
                    min="100"
                    value={editingPlan.monthlyTokenQuota}
                    onChange={(e) => setEditingPlan({ ...editingPlan, monthlyTokenQuota: Number(e.target.value) })}
                    className="dark-input"
                  />
                </div>
                <div className="form-group">
                  <label>Video Rate (tokens/min)</label>
                  <input
                    required
                    type="number"
                    value={editingPlan.videoRatePerMinute}
                    onChange={(e) => setEditingPlan({ ...editingPlan, videoRatePerMinute: Number(e.target.value) })}
                    className="dark-input"
                  />
                </div>
                <div className="form-group">
                  <label>Recording Rate (tokens/min)</label>
                  <input
                    required
                    type="number"
                    value={editingPlan.recordingRatePerMinute}
                    onChange={(e) => setEditingPlan({ ...editingPlan, recordingRatePerMinute: Number(e.target.value) })}
                    className="dark-input"
                  />
                </div>
                <div className="form-group">
                  <label>Transcription (tokens/min)</label>
                  <input
                    required
                    type="number"
                    value={editingPlan.transcriptionRatePerMinute}
                    onChange={(e) => setEditingPlan({ ...editingPlan, transcriptionRatePerMinute: Number(e.target.value) })}
                    className="dark-input"
                  />
                </div>
                <div className="form-group">
                  <label>Gemini AI Rate (tokens/req)</label>
                  <input
                    required
                    type="number"
                    value={editingPlan.geminiRatePerRequest}
                    onChange={(e) => setEditingPlan({ ...editingPlan, geminiRatePerRequest: Number(e.target.value) })}
                    className="dark-input"
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={handleCloseModal}
                  className="admin-btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="admin-btn"
                  disabled={submitting}
                >
                  {submitting ? 'Updating...' : 'Update Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};