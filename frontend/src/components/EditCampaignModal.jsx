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
  const [urgency, setUrgency] = useState('HIGH (EMERGENCY AID)');
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
      setUrgency(camp.urgency || 'HIGH (EMERGENCY AID)');
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
        showWarning('Please log in to edit campaign details.', 'Authentication Required');
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
        throw new Error(errData.error || 'Failed to update campaign details.');
      }

      showSuccess('Campaign details updated successfully!', 'Changes Saved');
      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      showError(err.message, 'Update Failed');
    } finally {
      setSaving(false);
    }
  };

  const targetPhp = parseFloat(camp.targetAmount || 1) * 170000;

  return createPortal(
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '16px'
      }}
    >
      <div
        className="card glow fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '780px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '18px',
          background: 'var(--bg-card, #131622)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.75)'
        }}
      >
        {/* Modal Top Banner */}
        <div style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(34, 197, 94, 0.08) 100%)',
          borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0284c7, #22c55e)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
              flexShrink: 0
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>edit_note</span>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Edit Campaign Details
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Campaign #{camp.id} • <strong style={{ color: 'var(--text-secondary)' }}>{camp.title}</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Financial Lock Notice Strip */}
        <div style={{
          background: 'rgba(56, 189, 248, 0.05)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)'
        }}>
          <span className="material-symbols-outlined" style={{ color: '#38bdf8', fontSize: '18px', flexShrink: 0 }}>lock</span>
          <span>
            Financial goal (<strong style={{ color: 'var(--text-primary)' }}>₱{targetPhp.toLocaleString('en-US', { maximumFractionDigits: 0 })} PHP</strong>) is permanently recorded on the blockchain. You can update relief dates, contact information, target location, and field updates below.
          </span>
        </div>

        {/* Scrollable Form Content (Matching Deploy Form Card Style) */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section 1: Relief Timeline & Priority */}
          <div className="deploy-section-card" style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            borderRadius: '14px',
            padding: '18px'
          }}>
            <div className="deploy-section-header" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              paddingBottom: '10px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                <span className="material-symbols-outlined" style={{ color: '#0284c7', fontSize: '20px' }}>schedule</span>
                <span>1. Relief Timeline & Priority Level</span>
              </div>
              <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Timeline</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              {/* Target Relief Delivery Date */}
              <div>
                <label className="deploy-input-label" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Target Relief Delivery Date
                </label>
                <input
                  type="date"
                  className="input deploy-field-input"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* Priority / Urgency */}
              <div>
                <label className="deploy-input-label" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Relief Priority Level
                </label>
                <select
                  className="input deploy-field-input"
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}
                >
                  <option value="HIGH (EMERGENCY AID)">🚨 Emergency Aid (High Priority)</option>
                  <option value="MEDIUM (URGENT REHABILITATION)">⚡ Urgent Rehabilitation (Medium Priority)</option>
                  <option value="STABLE (CHARITABLE AID)">🌱 Sustained Support (Stable)</option>
                </select>
              </div>

              {/* Campaign Tags */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="deploy-input-label" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Relief Focus Tags (comma-separated)
                </label>
                <input
                  type="text"
                  className="input deploy-field-input"
                  placeholder="e.g. Typhoon Disaster Aid, Immediate Food Packs, Clean Water Access"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* Mission Purpose & Description */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="deploy-input-label" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Campaign Mission & Public Appeal
                </label>
                <textarea
                  rows={4}
                  className="input deploy-field-input"
                  placeholder="Describe the urgent situation on the ground, the relief operations being conducted, and how donations will help..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6 }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Relief Area & Location */}
          <div className="deploy-section-card" style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            borderRadius: '14px',
            padding: '18px'
          }}>
            <div className="deploy-section-header" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              paddingBottom: '10px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                <span className="material-symbols-outlined" style={{ color: '#22c55e', fontSize: '20px' }}>location_on</span>
                <span>2. Relief Operation Area</span>
              </div>
              <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Location</span>
            </div>

            <div>
              <label className="deploy-input-label" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Complete Address & Distribution Area
              </label>
              <input
                type="text"
                className="input deploy-field-input"
                placeholder="e.g. Barangay San Jose, Sogod, Southern Leyte • Municipal Evacuation Center"
                value={locationRegion}
                onChange={(e) => setLocationRegion(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
              <div style={{ marginTop: '6px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Specifying the exact barangay, municipality, and relief landmark ensures full transparency for donors and review panels.
              </div>
            </div>
          </div>

          {/* Section 3: Community Impact & Field Contacts */}
          <div className="deploy-section-card" style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            borderRadius: '14px',
            padding: '18px'
          }}>
            <div className="deploy-section-header" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              paddingBottom: '10px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                <span className="material-symbols-outlined" style={{ color: '#38bdf8', fontSize: '20px' }}>groups</span>
                <span>3. Community Impact & Verification</span>
              </div>
              <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Transparency</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              {/* Beneficiary Impact Target */}
              <div>
                <label className="deploy-input-label" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Target Beneficiaries & Families
                </label>
                <input
                  type="text"
                  className="input deploy-field-input"
                  placeholder="e.g. 500 Families / 2,000 Individuals in Southern Leyte"
                  value={beneficiariesImpact}
                  onChange={(e) => setBeneficiariesImpact(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* Official Hotline / Contact Desk */}
              <div>
                <label className="deploy-input-label" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Official Field Contact & Hotline
                </label>
                <input
                  type="text"
                  className="input deploy-field-input"
                  placeholder="e.g. Director Juan Santos • 0917-123-4567"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* Supporting Document / Proof URL */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="deploy-input-label" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Official Resolution / Transparency Document URL (Optional)
                </label>
                <input
                  type="url"
                  className="input deploy-field-input"
                  placeholder="https://drive.google.com/... or official public PDF URL"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          {/* Modal Actions Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '8px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.08))'
          }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={saving}
              style={{ padding: '9px 18px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary glow"
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 24px',
                fontWeight: 700
              }}
            >
              {saving ? (
                <>
                  <div className="spinner spinner-light" style={{ width: 16, height: 16 }} />
                  <span>Saving Changes…</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                  <span>Save Changes</span>
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
