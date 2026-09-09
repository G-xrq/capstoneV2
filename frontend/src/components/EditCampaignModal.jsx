import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '../config';
import { useToast } from '../context/ToastContext';

export default function EditCampaignModal({ camp, isOpen, onClose, onSaved }) {
  const { showSuccess, showError, showWarning } = useToast();

  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [beneficiariesImpact, setBeneficiariesImpact] = useState('');
  const [locationRegion, setLocationRegion] = useState('');
  const [urgency, setUrgency] = useState('HIGH');
  const [tags, setTags] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (camp && isOpen) {
      setDescription(camp.description || '');
      setTargetDate(camp.targetDate || camp.target_date || '');
      setContactInfo(camp.contactInfo || camp.contact_info || '');
      setBeneficiariesImpact(camp.beneficiariesImpact || camp.beneficiaries_impact || '');
      setLocationRegion(camp.locationRegion || camp.location_region || camp.location || '');
      setUrgency(camp.urgency || 'HIGH');
      const rawTags = camp.tags || camp.tags_json || camp.tagsJson;
      if (Array.isArray(rawTags)) {
        setTags(rawTags.join(', '));
      } else {
        setTags(String(rawTags || ''));
      }
      setDocumentUrl(camp.documentUrl || camp.document_url || '');
    }
  }, [camp, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !camp) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    try {
      setSaving(true);
      const token = localStorage.getItem('bbdrts_token');
      if (!token) {
        showWarning('Please login to edit campaign logistics.', 'Authentication Required');
        return;
      }

      const res = await fetch(`${API_URL}/api/campaigns/${camp.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          description: description.trim(),
          target_date: targetDate.trim(),
          contact_info: contactInfo.trim(),
          beneficiaries_impact: beneficiariesImpact.trim(),
          location_region: locationRegion.trim(),
          urgency,
          tags: tags.trim(),
          document_url: documentUrl.trim()
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update campaign logistics.');
      }

      showSuccess('Campaign operational logistics updated successfully!', 'Changes Saved');
      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      showError(err.message, 'Update Failed');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="bbdrts-edit-profile-backdrop"
      onClick={onClose}
      style={{ zIndex: 9999999 }}
    >
      <div
        className="bbdrts-profile-studio-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '680px', height: 'auto', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Modal Header */}
        <div className="bbdrts-studio-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'var(--accent-dim, rgba(34, 197, 94, 0.12))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent, #22c55e)'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit_note</span>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                Edit Campaign Operational Logistics
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Campaign #{camp.id} • {camp.title}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.2rem',
              cursor: 'pointer',
              padding: '4px'
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Informational Banner */}
        <div style={{
          background: 'var(--bg-subcard)',
          borderBottom: '1px solid var(--border)',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)'
        }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--accent, #22c55e)', fontSize: '16px' }}>lock</span>
          <span>
            Financial target (<strong style={{ color: 'var(--text-primary)' }}>₱{(parseFloat(camp.targetAmount || 1) * 170000).toLocaleString('en-US')} PHP</strong>) is cryptographically locked on Sepolia EVM. Operational relief logistics below can be updated at any time.
          </span>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Row 1: Target Delivery Date & Urgency Priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                📅 Target Relief Delivery Date
              </label>
              <input
                type="text"
                placeholder="e.g. Nov 30, 2026 or Immediate Dispatch"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                ⚡ Urgency Priority Level
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                }}
              >
                <option value="CRITICAL">🔴 CRITICAL (Level 4 Flash Calamity)</option>
                <option value="HIGH">🟠 HIGH (Emergency Aid Dispatch)</option>
                <option value="MEDIUM">🟡 MEDIUM (Sustained Relief Support)</option>
                <option value="STABLE">🟢 STABLE / ESSENTIAL (Rehabilitation Aid)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Emergency Hotline / Contact Desk */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              📞 Emergency Hotline / Ground Contact Desk
            </label>
            <input
              type="text"
              placeholder="e.g. Mobile: +63 917 123 4567 | Desk: hotline@reliefph.org"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '9px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Row 3: Target Beneficiaries / Families Impacted */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              👥 Beneficiaries Scope & Impact Target
            </label>
            <input
              type="text"
              placeholder="e.g. 500 Coastal Fisherfolk Families & Evacuees"
              value={beneficiariesImpact}
              onChange={(e) => setBeneficiariesImpact(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '9px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Row 4: Distribution Location & Landmark */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              📍 Distribution Location & Relief Evacuation Landmark
            </label>
            <input
              type="text"
              placeholder="e.g. Southern Leyte Sports Complex Evacuation Center"
              value={locationRegion}
              onChange={(e) => setLocationRegion(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '9px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Row 5: Tags (Comma Separated) */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              🏷️ Campaign Tags (comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g. Typhoon Relief, Immediate Food Packs, Clean Water"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '9px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Row 6: Mission Scope & Humanitarian Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              📝 Mission Purpose & Humanitarian Scope
            </label>
            <textarea
              rows={4}
              placeholder="Detail the emergency response objectives, supply distribution plans, and ground logistics..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '10px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'vertical',
                lineHeight: 1.5
              }}
            />
          </div>

          {/* Row 7: Official Press Release / Verification Document Link */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              🔗 Official Verification Document / Press Release URL
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={documentUrl}
              onChange={(e) => setDocumentUrl(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '9px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Modal Actions Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '10px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border)'
          }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm glow"
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px' }}
            >
              {saving ? (
                <>
                  <div className="spinner spinner-light" style={{ width: 16, height: 16 }} />
                  <span>Saving Updates…</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>save</span>
                  <span>Save Logistics Update</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
