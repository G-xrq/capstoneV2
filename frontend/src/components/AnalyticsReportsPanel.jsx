import { useState, useEffect, useCallback, useRef } from 'react';
import { API_URL } from '../config';
import { useToast } from '../context/ToastContext';
import {
  VercelAreaLineChart,
  VercelDonutChart,
  VercelBarChart,
  VercelFunnelMeter
} from './AnalyticsCharts';
import {
  exportExcelWorkbook,
  exportFormattedCsv,
  exportStructuredJson,
  exportPrintablePdfReport
} from '../utils/reportExporter';
import './AnalyticsReportsPanel.css';

const RANGE_OPTIONS = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: 'all', label: 'All' }
];

const CATEGORY_OPTIONS = [
  { value: 'ALL', label: 'All Causes' },
  { value: 'DISASTER', label: 'Disaster Relief' },
  { value: 'MEDICAL', label: 'Medical & Health' },
  { value: 'EDUCATION', label: 'Education & Youth' },
  { value: 'COMMUNITY', label: 'Community & Housing' }
];

const RAIL_COLORS = {
  'Bank / Card': 'var(--va-series-primary, #3291FF)',
  'Sepolia ETH': 'var(--va-series-mono, #ededed)',
  GCash: '#10b981',
  Maya: '#71717a'
};

export default function AnalyticsReportsPanel({ mode = 'admin', onNavigateTab }) {
  const isAdmin = mode === 'admin';
  const { showSuccess, showError } = useToast();

  const [range, setRange] = useState('30d');
  const [category, setCategory] = useState('ALL');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [campSearch, setCampSearch] = useState('');
  const exportMenuRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') setExportMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  const fetchAnalytics = useCallback(async (silent = false) => {
    const token = localStorage.getItem('bbdrts_token') || localStorage.getItem('token');
    if (!token) return;
    if (!silent) setRefreshing(true);
    try {
      const endpoint = isAdmin ? '/api/admin/analytics' : '/api/organization/analytics';
      const qs = new URLSearchParams({ range });
      if (isAdmin && category && category !== 'ALL') {
        qs.set('category', category);
      }
      const res = await fetch(`${API_URL}${endpoint}?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load analytics data.');
      }
      setAnalytics(data);
    } catch (err) {
      if (!silent) {
        showError(err.message || 'Could not retrieve analytics telemetry.', 'Analytics Unavailable');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, range, category, showError]);

  useEffect(() => {
    fetchAnalytics(false);
  }, [fetchAnalytics]);

  const handleExport = (format) => {
    setExportMenuOpen(false);
    if (!analytics) return;
    try {
      if (format === 'xlsx') {
        const file = exportExcelWorkbook(analytics, { mode });
        showSuccess(`Generated multi-sheet Excel report "${file}".`, 'Excel Export Ready');
      } else if (format === 'pdf') {
        exportPrintablePdfReport(analytics, { mode });
        showSuccess('Opened executive PDF print layout.', 'PDF Report Ready');
      } else if (format === 'csv') {
        const file = exportFormattedCsv(analytics, { mode });
        showSuccess(`Downloaded structured report "${file}".`, 'CSV Export Ready');
      } else if (format === 'json') {
        const file = exportStructuredJson(analytics, { mode });
        showSuccess(`Downloaded JSON audit bundle "${file}".`, 'JSON Export Ready');
      }
    } catch (err) {
      showError(err.message || 'Export failed.', 'Report Export Error');
    }
  };

  const kpis = analytics?.kpis || {};
  const trendSeries = analytics?.trendSeries || [];
  const paymentRails = analytics?.paymentRails || [];
  const categoryBreakdown = analytics?.categoryBreakdown || [];
  const regionalBreakdown = analytics?.regionalBreakdown || [];
  const verificationFunnel = analytics?.verificationFunnel || {};
  const topOrganizations = analytics?.topOrganizations || [];
  const activityBreakdown = analytics?.activityBreakdown || [];
  const topContributors = analytics?.topContributors || [];
  const insights = analytics?.insights || [];
  const campaigns = (analytics?.campaignPerformance || []).filter((c) => {
    if (!campSearch.trim()) return true;
    const q = campSearch.toLowerCase();
    return (
      String(c.title || '').toLowerCase().includes(q) ||
      String(c.orgName || '').toLowerCase().includes(q) ||
      String(c.region || '').toLowerCase().includes(q) ||
      String(c.categoryLabel || '').toLowerCase().includes(q)
    );
  });

  const deltaNum = kpis.periodDeltaPct;
  const hasDelta = deltaNum !== null && deltaNum !== undefined;

  return (
    <div className="va-root analytics-panel-root">
      {/* ── Top Bar: Clean Geist Heading + Right-Aligned Controls ── */}
      <header className="va-header">
        <div className="va-header-title-wrap">
          <h2 className="va-page-title">
            {isAdmin ? 'Analytics & Reports' : 'NGO Analytics & Reports'}
          </h2>
          <p className="va-page-sub">
            {isAdmin
              ? 'Contribution velocity, rail share, regional reach, and formatted exports.'
              : `Fundraising velocity, channel share, and exports for ${analytics?.meta?.orgName || 'your organization'}.`}
          </p>
        </div>

        <div className="va-controls analytics-header-controls">
          <div className="va-range-group" role="group" aria-label="Time window filter">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`va-range-btn ${range === r.id ? 'active' : ''}`}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>

          {isAdmin && (
            <select
              className="va-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter analytics by cause category"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="va-icon-btn"
            onClick={() => fetchAnalytics(false)}
            disabled={refreshing}
            title="Refresh live analytics"
            aria-label="Refresh analytics"
          >
            <span className={`material-symbols-outlined ${refreshing ? 'va-spin' : ''}`}>refresh</span>
          </button>

          <div className="va-export-wrap" ref={exportMenuRef}>
            <button
              type="button"
              className="va-export-btn analytics-export-primary"
              onClick={() => setExportMenuOpen((prev) => !prev)}
              disabled={!analytics || loading}
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
            >
              <span className="material-symbols-outlined">download</span>
              <span>Export</span>
              <span className="material-symbols-outlined va-caret">
                {exportMenuOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {exportMenuOpen && (
              <div className="va-export-menu" role="menu">
                <div className="va-export-menu-head">Download report</div>
                <button type="button" className="va-export-option analytics-export-item" role="menuitem" onClick={() => handleExport('xlsx')}>
                  <div className="va-export-option-main">
                    <strong>Excel Workbook</strong>
                    <span>6 formatted sheets with totals</span>
                  </div>
                  <span className="va-ext-tag">.xlsx</span>
                </button>
                <button type="button" className="va-export-option analytics-export-item" role="menuitem" onClick={() => handleExport('pdf')}>
                  <div className="va-export-option-main">
                    <strong>Executive PDF Report</strong>
                    <span>Print-ready whitepaper &amp; tables</span>
                  </div>
                  <span className="va-ext-tag">.pdf</span>
                </button>
                <button type="button" className="va-export-option analytics-export-item" role="menuitem" onClick={() => handleExport('csv')}>
                  <div className="va-export-option-main">
                    <strong>Structured CSV</strong>
                    <span>UTF-8 Excel-compatible tables</span>
                  </div>
                  <span className="va-ext-tag">.csv</span>
                </button>
                <button type="button" className="va-export-option analytics-export-item" role="menuitem" onClick={() => handleExport('json')}>
                  <div className="va-export-option-main">
                    <strong>Audit JSON Bundle</strong>
                    <span>Full metrics &amp; ledger archive</span>
                  </div>
                  <span className="va-ext-tag">.json</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {loading && !analytics ? (
        <div className="va-panel va-loading-panel">
          <span className="material-symbols-outlined va-spin">progress_activity</span>
          <span>Loading live analytics telemetry...</span>
        </div>
      ) : (
        <>
          {/* ── Unified Vercel Hero Frame: 4 KPI Columns + Smooth Monotone Area Graph ── */}
          <section className="va-panel va-hero-panel">
            <div className="va-kpi-grid analytics-kpi-strip">
              <div className="va-kpi-cell">
                <div className="va-kpi-top">
                  <span className="va-kpi-label">Mobilized</span>
                  {hasDelta ? (
                    <span className={`va-delta-pill ${deltaNum < 0 ? 'neg' : 'pos'}`}>
                      {deltaNum >= 0 ? '+' : ''}{deltaNum}%
                    </span>
                  ) : (
                    <span className="va-delta-pill neutral">All time</span>
                  )}
                </div>
                <div className="va-kpi-value">
                  ₱{Number(kpis.totalMobilizedPhp || 0).toLocaleString('en-US')}
                </div>
                <div className="va-kpi-sub">
                  {Number(kpis.totalMobilizedEth || 0).toFixed(4)} ETH equivalent
                </div>
              </div>

              <div className="va-kpi-cell">
                <div className="va-kpi-top">
                  <span className="va-kpi-label">Avg Gift</span>
                  <span className="va-kpi-tag">{kpis.txCount || 0} tx</span>
                </div>
                <div className="va-kpi-value">
                  ₱{Number(kpis.avgGiftPhp || 0).toLocaleString('en-US')}
                </div>
                <div className="va-kpi-sub">
                  {isAdmin
                    ? `${kpis.totalDonors || 0} registered donors`
                    : `${kpis.uniqueDonors || 0} backers · ${kpis.anonymousSharePct || 0}% anon`}
                </div>
              </div>

              <div className="va-kpi-cell">
                <div className="va-kpi-top">
                  <span className="va-kpi-label">Disbursed</span>
                  <span className="va-kpi-tag">{kpis.utilizationPct || 0}%</span>
                </div>
                <div className="va-kpi-value">
                  ₱{Number(kpis.totalDisbursedPhp || 0).toLocaleString('en-US')}
                </div>
                <div className="va-kpi-sub">
                  {isAdmin
                    ? `${kpis.totalBeneficiaries || 0} beneficiaries served`
                    : `₱${Number(kpis.remainingEscrowPhp || 0).toLocaleString('en-US')} escrow left`}
                </div>
              </div>

              <div className="va-kpi-cell">
                <div className="va-kpi-top">
                  <span className="va-kpi-label">Goal Pacing</span>
                  <span className="va-kpi-tag">
                    {isAdmin ? `${kpis.approvedOrgs || 0} NGOs` : `${kpis.pendingSlipsCount || 0} slips`}
                  </span>
                </div>
                <div className="va-kpi-value">
                  {kpis.avgFundingPct || 0}%
                </div>
                <div className="va-kpi-sub">
                  {isAdmin
                    ? `${kpis.activeCampaigns || 0} active · ${kpis.pendingOrgs || 0} KYC pending`
                    : `${kpis.activeCampaigns || 0} active · ${kpis.approvalRatePct || 0}% pass`}
                </div>
              </div>
            </div>

            <div className="va-hero-chart-body">
              <VercelAreaLineChart
                data={trendSeries}
                height={252}
                showCryptoSplit
                title={isAdmin ? 'Contribution & Disbursement Velocity' : 'Fundraising & Disbursement Velocity'}
              />
            </div>
          </section>

          {/* ── Quiet Hairline Highlights Rail (Single Connected Strip, Zero Glow) ── */}
          {insights.length > 0 && (
            <section className="va-panel va-highlights-strip" aria-label="Automated insights">
              {insights.slice(0, 4).map((ins, i) => (
                <div key={i} className="va-highlight-cell">
                  <div className="va-highlight-title-row">
                    {ins.tone === 'amber' && <span className="va-dot-sm warn" />}
                    <strong>{ins.title}</strong>
                  </div>
                  <p>{ins.detail}</p>
                </div>
              ))}
            </section>
          )}

          {/* ── Row 2: Payment Channels (Thin Donut) + Breakdown by Cause (Vercel List Bars) ── */}
          <div className="va-two-col">
            <section className="va-panel">
              <div className="va-panel-head">
                <div>
                  <h3 className="va-section-heading">Payment Channels</h3>
                  <p className="va-panel-sub">Share of verified inflows by settlement rail</p>
                </div>
              </div>
              <div className="va-panel-body">
                <VercelDonutChart
                  centerLabel="Period"
                  centerValue={`₱${Number(kpis.totalMobilizedPhp || 0).toLocaleString('en-US')}`}
                  items={paymentRails.map((r) => ({
                    key: r.rail,
                    label: r.rail,
                    value: r.php,
                    meta: `${r.count} tx · ${r.eth} ETH`,
                    displayValue: `₱${Number(r.php || 0).toLocaleString('en-US')}`,
                    color: RAIL_COLORS[r.rail]
                  }))}
                />
              </div>
            </section>

            <section className="va-panel">
              <div className="va-panel-head">
                <div>
                  <h3 className="va-section-heading">
                    {isAdmin ? 'Mobilization by Cause' : 'Operations by Cause'}
                  </h3>
                  <p className="va-panel-sub">Raised capital relative to active targets</p>
                </div>
              </div>
              <div className="va-panel-body">
                <VercelBarChart
                  items={categoryBreakdown.map((c) => ({
                    key: c.key,
                    label: c.label,
                    sub: `${c.campaignCount} op${c.campaignCount === 1 ? '' : 's'} · Goal ₱${Number(c.targetPhp || 0).toLocaleString('en-US')}`,
                    value: c.raisedPhp,
                    badge: `${c.fundingPct}%`
                  }))}
                />
              </div>
            </section>
          </div>

          {/* ── Row 3: Role-Tailored Breakdowns (Admin Geo/NGOs vs NGO Goals/Supporters) ── */}
          {isAdmin ? (
            <div className="va-two-col">
              <section className="va-panel">
                <div className="va-panel-head">
                  <div>
                    <h3 className="va-section-heading">Geographic Reach by Philippine Region</h3>
                    <p className="va-panel-sub">Mobilized relief funding across regional zones</p>
                  </div>
                </div>
                <div className="va-panel-body">
                  <VercelBarChart
                    maxItems={6}
                    items={regionalBreakdown.map((r) => ({
                      key: r.region,
                      label: r.region,
                      sub: `${r.campaignCount} campaign${r.campaignCount === 1 ? '' : 's'} · ${r.fundingPct}% funded`,
                      value: r.raisedPhp,
                      badge: `${r.campaignCount} ops`
                    }))}
                  />
                </div>
              </section>

              <section className="va-panel">
                <div className="va-panel-head">
                  <div>
                    <h3 className="va-section-heading">Top Accredited NGOs &amp; Slip Audit Health</h3>
                    <p className="va-panel-sub">Manual receipt pass rate and leading partners</p>
                  </div>
                  {onNavigateTab && (
                    <button type="button" className="va-ghost-link" onClick={() => onNavigateTab('approvals')}>
                      NGO Desk
                    </button>
                  )}
                </div>
                <div className="va-panel-body va-stack-body">
                  <VercelFunnelMeter funnel={verificationFunnel} />
                  <div className="va-sub-divider" />
                  <VercelBarChart
                    maxItems={4}
                    items={topOrganizations.filter((o) => o.raisedPhp > 0 || o.campaignCount > 0).map((o) => ({
                      key: String(o.orgId),
                      label: o.orgName,
                      sub: `${o.status} · ${o.campaignCount} op${o.campaignCount === 1 ? '' : 's'}`,
                      value: o.raisedPhp,
                      badge: `${o.fundingPct}%`
                    }))}
                  />
                </div>
              </section>
            </div>
          ) : (
            <div className="va-two-col">
              <section className="va-panel">
                <div className="va-panel-head">
                  <div>
                    <h3 className="va-section-heading">Campaign Goal Completion Progress</h3>
                    <p className="va-panel-sub">Quota completion across your active and concluded drives</p>
                  </div>
                </div>
                <div className="va-panel-body">
                  <VercelBarChart
                    maxItems={6}
                    items={[...(analytics?.campaignPerformance || [])]
                      .sort((a, b) => b.fundingPct - a.fundingPct)
                      .map((c) => ({
                        key: String(c.id),
                        label: c.title,
                        sub: `${c.region} · Target ₱${Number(c.targetPhp || 0).toLocaleString('en-US')}`,
                        value: c.raisedPhp,
                        forcePct: c.fundingPct,
                        displayValue: `₱${Number(c.raisedPhp || 0).toLocaleString('en-US')}`,
                        badge: `${c.fundingPct}%`
                      }))}
                  />
                </div>
              </section>

              <section className="va-panel">
                <div className="va-panel-head">
                  <div>
                    <h3 className="va-section-heading">Slip Audit Health &amp; Top Supporters</h3>
                    <p className="va-panel-sub">Receipt verification status and top contributors</p>
                  </div>
                  {onNavigateTab && (
                    <button type="button" className="va-ghost-link" onClick={() => onNavigateTab('ledger')}>
                      Open Ledger
                    </button>
                  )}
                </div>
                <div className="va-panel-body va-stack-body">
                  <VercelFunnelMeter funnel={verificationFunnel} />
                  <div className="va-sub-divider" />
                  <VercelBarChart
                    maxItems={4}
                    emptyMessage="No confirmed contributors in this period yet."
                    items={topContributors.map((d, i) => ({
                      key: `${d.name}-${i}`,
                      label: d.name,
                      sub: `${d.count} gift${d.count === 1 ? '' : 's'} · ${d.eth} ETH`,
                      value: d.php,
                      badge: d.isAnonymous ? 'Anon' : `${d.count}×`
                    }))}
                  />
                </div>
              </section>
            </div>
          )}

          {/* ── Row 4 (Admin Only): Compact Hairline Audit Event Strip ── */}
          {isAdmin && activityBreakdown.length > 0 && (
            <section className="va-panel">
              <div className="va-panel-head">
                <div>
                  <h3 className="va-section-heading">System Audit Activity Breakdown</h3>
                  <p className="va-panel-sub">Recorded security, verification, and operational events</p>
                </div>
              </div>
              <div className="va-audit-strip">
                {activityBreakdown.map((act) => (
                  <div key={act.category} className="va-audit-cell">
                    <span className="va-audit-label">{act.label}</span>
                    <div className="va-audit-nums">
                      <strong>{act.count.toLocaleString('en-US')}</strong>
                      <span>{act.sharePct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Flush Vercel Data Table: Campaign Performance Matrix ── */}
          <section className="va-panel">
            <div className="va-panel-head va-table-head-bar">
              <div>
                <h3 className="va-section-heading">
                  {isAdmin ? 'Portfolio Performance Matrix' : 'Campaign Performance Matrix'}
                </h3>
                <p className="va-panel-sub">
                  Included directly in Excel (.xlsx), PDF, and CSV report exports
                </p>
              </div>

              <div className="va-search-box">
                <span className="material-symbols-outlined">search</span>
                <input
                  type="text"
                  placeholder="Filter operations..."
                  value={campSearch}
                  onChange={(e) => setCampSearch(e.target.value)}
                />
              </div>
            </div>

            {campaigns.length === 0 ? (
              <div className="va-empty-state" style={{ minHeight: '130px' }}>
                <span>No campaign performance records match your filters.</span>
              </div>
            ) : (
              <div className="va-table-scroll">
                <table className="va-table">
                  <thead>
                    <tr>
                      <th>Operation</th>
                      {isAdmin && <th>Organization</th>}
                      <th>Cause &amp; Region</th>
                      <th className="num">Goal</th>
                      <th className="num">Raised</th>
                      <th className="num">Funded</th>
                      <th className="num">Disbursed</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="va-cell-primary" title={c.title}>{c.title}</div>
                          <div className="va-cell-sub">#{c.id} · {c.urgency}</div>
                        </td>
                        {isAdmin && <td className="va-cell-org">{c.orgName}</td>}
                        <td>
                          <div className="va-cell-cat">{c.categoryLabel}</div>
                          <div className="va-cell-sub">{c.region}</div>
                        </td>
                        <td className="num mono muted">₱{Number(c.targetPhp || 0).toLocaleString('en-US')}</td>
                        <td className="num mono strong">₱{Number(c.raisedPhp || 0).toLocaleString('en-US')}</td>
                        <td className="num">
                          <div className="va-inline-progress">
                            <div className="va-inline-track">
                              <div
                                className="va-inline-fill"
                                style={{ width: `${Math.min(100, Number(c.fundingPct || 0))}%` }}
                              />
                            </div>
                            <span className="mono">{c.fundingPct}%</span>
                          </div>
                        </td>
                        <td className="num mono muted">₱{Number(c.disbursedPhp || 0).toLocaleString('en-US')}</td>
                        <td>
                          <span className={`va-status-dot-label ${c.isActive ? 'active' : 'closed'}`}>
                            <span className="va-status-dot" />
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
