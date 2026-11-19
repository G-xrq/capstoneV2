import './CampaignSkeletonCard.css';

/**
 * CampaignSkeletonCard
 * 1:1 Pixel-Perfect Skeleton Loading Placeholder mirroring CampaignCard layout & geometry.
 * Identical width, height, padding, columns, and responsive grid/list transitions.
 */
export default function CampaignSkeletonCard() {
  return (
    <div
      className="card campaign-card campaign-skeleton-card"
      role="status"
      aria-busy="true"
      aria-label="Loading relief campaign"
    >
      <div className="campaign-card-body">

        {/* ── 1. Left: Cover Media (215px × 230px) ── */}
        <div className="campaign-media campaign-skeleton-media">
          <div className="campaign-skeleton-shimmer campaign-skeleton-cover" />

          {/* Top Category Tag Capsule */}
          <div className="campaign-media-tag-top campaign-skeleton-tag-top">
            <span className="campaign-skeleton-shimmer" style={{ width: '82px', height: '18px', borderRadius: '50px' }} />
          </div>

          {/* Disaster Evidence Photos Badge */}
          <div className="campaign-media-evidence-badge campaign-skeleton-evidence-badge">
            <span className="campaign-skeleton-shimmer" style={{ width: '74px', height: '16px', borderRadius: '4px' }} />
          </div>
        </div>

        {/* ── 2. Center: Info Section ── */}
        <div className="campaign-info">
          {/* Row 1: Badges (Category & Status) */}
          <div className="campaign-header-top" style={{ gap: '8px' }}>
            <span className="campaign-skeleton-shimmer" style={{ width: '105px', height: '22px', borderRadius: '6px' }} />
            <span className="campaign-skeleton-shimmer" style={{ width: '65px', height: '22px', borderRadius: '999px' }} />
          </div>

          {/* Row 2: Campaign Title (Single-line matching CampaignCard) */}
          <div style={{ height: '24px', display: 'flex', alignItems: 'center', marginTop: '0', marginBottom: '6px' }}>
            <span className="campaign-skeleton-shimmer" style={{ display: 'block', width: '75%', height: '18px', borderRadius: '4px' }} />
          </div>

          {/* Row 3: Managing Org & Ground Location Attribution */}
          <div className="campaign-org-row" style={{ gap: '8px', marginTop: '4px', marginBottom: '6px' }}>
            <span className="campaign-skeleton-shimmer" style={{ width: '135px', height: '24px', borderRadius: '999px' }} />
            <span className="campaign-skeleton-shimmer" style={{ width: '125px', height: '24px', borderRadius: '999px' }} />
          </div>

          {/* Row 4: Funding Goal & Percent */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', marginBottom: '4px' }}>
            <span className="campaign-skeleton-shimmer" style={{ width: '175px', height: '15px', borderRadius: '4px' }} />
            <span className="campaign-skeleton-shimmer" style={{ width: '75px', height: '20px', borderRadius: '999px' }} />
          </div>

          {/* Row 5: Multi-Rail Track */}
          <div style={{ width: '100%', height: '6px', borderRadius: '999px', overflow: 'hidden' }}>
            <span className="campaign-skeleton-shimmer" style={{ display: 'block', width: '100%', height: '100%' }} />
          </div>

          {/* Row 6: Metadata Strip */}
          <div className="campaign-meta-strip" style={{ marginTop: '4px' }}>
            <div className="campaign-meta-strip-left" style={{ gap: '8px' }}>
              <span className="campaign-skeleton-shimmer" style={{ width: '60px', height: '14px', borderRadius: '4px' }} />
              <span className="campaign-skeleton-shimmer" style={{ width: '135px', height: '14px', borderRadius: '4px' }} />
              <span className="campaign-skeleton-shimmer" style={{ width: '85px', height: '14px', borderRadius: '4px' }} />
            </div>
            <span className="campaign-skeleton-shimmer" style={{ width: '45px', height: '14px', borderRadius: '4px', marginLeft: 'auto' }} />
          </div>

          {/* Row 7: Tags Row */}
          <div className="campaign-tags-row" style={{ marginTop: '8px', gap: '6px' }}>
            <span className="campaign-skeleton-shimmer" style={{ width: '95px', height: '20px', borderRadius: '6px' }} />
            <span className="campaign-skeleton-shimmer" style={{ width: '110px', height: '20px', borderRadius: '6px' }} />
            <span className="campaign-skeleton-shimmer" style={{ width: '88px', height: '20px', borderRadius: '6px' }} />
            <span className="campaign-skeleton-shimmer" style={{ width: '28px', height: '20px', borderRadius: '6px' }} />
          </div>
        </div>

        {/* ── 3. Right: Action Section ── */}
        <div className="campaign-actions">
          {/* Contribution Box Card */}
          <div className="donate-box-card" style={{ gap: '8px', padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="campaign-skeleton-shimmer" style={{ width: '14px', height: '14px', borderRadius: '3px' }} />
              <span className="campaign-skeleton-shimmer" style={{ width: '90px', height: '12px', borderRadius: '3px' }} />
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span className="campaign-skeleton-shimmer" style={{ flex: 1, height: '36px', borderRadius: '8px' }} />
              <span className="campaign-skeleton-shimmer" style={{ width: '80px', height: '36px', borderRadius: '8px' }} />
            </div>
          </div>

          {/* Secondary Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
            <span className="campaign-skeleton-shimmer" style={{ width: '100%', height: '30px', borderRadius: '6px' }} />
            <span className="campaign-skeleton-shimmer" style={{ width: '100%', height: '28px', borderRadius: '6px' }} />
          </div>

          {/* Bottom Utility Tools: Track & Share */}
          <div className="campaign-utility-footer" style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <span className="campaign-skeleton-shimmer" style={{ width: '65px', height: '24px', borderRadius: '999px' }} />
            <span className="campaign-skeleton-shimmer" style={{ width: '65px', height: '24px', borderRadius: '999px' }} />
          </div>
        </div>

      </div>
    </div>
  );
}
