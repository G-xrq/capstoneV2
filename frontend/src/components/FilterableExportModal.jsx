import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  resolveDonationPhp,
  normalizePaymentRail,
  exportDonorReportExcel,
  exportDonorReportCsv,
  exportDonorPrintableReport,
  exportNgoLedgerExcel,
  exportNgoLedgerCsv,
  exportNgoAuditPdf,
  exportAdminFinancialLedgerExcel,
  exportAdminFinancialLedgerCsv,
  exportAdminFinancialLedgerPdf,
  exportAdminActivityLogsExcel,
  exportAdminActivityLogsCsv,
  exportAdminActivityLogsPdf
} from '../utils/reportExporter';
import GeistSelect from './GeistSelect';
import './FilterableExportModal.css';

const DATE_RANGES = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'year', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' }
];

const CHANNELS = [
  { id: 'ALL', label: 'All Channels' },
  { id: 'GCASH', label: 'GCash' },
  { id: 'MAYA', label: 'Maya' },
  { id: 'BANK_CARD', label: 'Bank / Card' }
];

const CATEGORIES = [
  { id: 'ALL', label: 'All Causes', sub: 'Disaster relief & charitable drives', icon: 'apps' },
  { id: 'DR', label: 'Disaster Relief', sub: 'Typhoon, flood, fire & emergency aid', icon: 'flood' },
  { id: 'CD', label: 'Charitable Aid', sub: 'Community outreach, medical & welfare', icon: 'volunteer_activism' }
];

const STATUSES = [
  { id: 'ALL', label: 'All Statuses', sub: 'Include verified & pending records', icon: 'fact_check' },
  { id: 'VERIFIED', label: 'Verified Only', sub: 'Notarized & confirmed transactions', icon: 'verified' },
  { id: 'PENDING', label: 'Pending / Review', sub: 'Awaiting NGO or admin confirmation', icon: 'hourglass_top' }
];

const LOG_CATEGORIES = [
  { id: 'ALL', label: 'All Categories', icon: 'apps' },
  { id: 'AUTH', label: 'AUTH', icon: 'lock' },
  { id: 'CAMPAIGN', label: 'CAMPAIGN', icon: 'campaign' },
  { id: 'DONATION', label: 'DONATION', icon: 'payments' },
  { id: 'DISBURSEMENT', label: 'DISBURSEMENT', icon: 'local_shipping' },
  { id: 'KYC', label: 'KYC', icon: 'badge' },
  { id: 'ADMIN', label: 'ADMIN', icon: 'admin_panel_settings' },
  { id: 'SYSTEM', label: 'SYSTEM', icon: 'dns' }
];

const LOG_ROLES = [
  { id: 'ALL', label: 'All Roles', icon: 'groups' },
  { id: 'ADMIN', label: 'ADMIN', icon: 'shield_person' },
  { id: 'NGO', label: 'NGO', icon: 'domain' },
  { id: 'DONOR', label: 'DONOR', icon: 'person' },
  { id: 'SYSTEM', label: 'SYSTEM', icon: 'memory' }
];

function resolveRecordDate(item) {
  const raw = item?.createdAt || item?.Created_At || item?.timestamp || item?.Timestamp || item?.Payment_Date;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function inferCampaignCategory(item, campaigns = []) {
  const camp = (campaigns || []).find((c) => String(c.id) === String(item.campaignId || item.Campaign_ID));
  if (camp?.category === 'CD' || camp?.category === 'DR') return camp.category;
  const title = String(item.campaignTitle || item.Campaign_Title || camp?.title || '');
  return /charity|charitable|school|orphan|outreach|scholarship|feeding|community|blood|medical|livelihood/i.test(title)
    ? 'CD'
    : 'DR';
}

export default function FilterableExportModal({
  isOpen,
  onClose,
  role = 'donor', // 'donor' | 'ngo' | 'admin_ledger' | 'admin_logs'
  title = 'Export Report',
  subtitle = 'Filter records and choose your preferred output format',
  records = [],
  campaigns = [],
  meta = {},
  initialFilters = {},
  onExported
}) {
  const [dateRange, setDateRange] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [channel, setChannel] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [campaignId, setCampaignId] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [logCategory, setLogCategory] = useState('ALL');
  const [logRole, setLogRole] = useState('ALL');
  const [search, setSearch] = useState('');

  // Seed initial filters whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    setDateRange(initialFilters.dateRange || 'all');
    setDateFrom('');
    setDateTo('');
    setChannel(initialFilters.channel || 'ALL');
    setCategory(initialFilters.category || 'ALL');
    setCampaignId(initialFilters.campaignId || 'ALL');
    setStatusFilter(initialFilters.status || 'ALL');
    setLogCategory(initialFilters.logCategory || 'ALL');
    setLogRole(initialFilters.logRole || 'ALL');
    setSearch(initialFilters.search || '');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const isLogs = role === 'admin_logs';

  // Unique campaign options present in the dataset (with helpful sub-metadata so duplicate titles are distinguishable)
  const campaignOptions = useMemo(() => {
    if (isLogs) return [];
    const map = new Map();
    (campaigns || []).forEach((c) => {
      if (!c?.id) return;
      const org = c.orgName || c.org_name || '';
      const loc = c.locationMunicipality || c.locationCity || c.locationProvince || '';
      const subParts = [`#${c.id}`, org, loc].filter(Boolean);
      const badge = c.isActive === false ? 'Closed' : (c.category === 'CD' ? 'Charity' : 'Relief');
      map.set(String(c.id), {
        id: String(c.id),
        label: c.title || `Campaign #${c.id}`,
        sub: subParts.join(' · '),
        badge,
        icon: c.category === 'CD' ? 'volunteer_activism' : 'campaign'
      });
    });
    (records || []).forEach((r) => {
      const cid = r.campaignId || r.Campaign_ID;
      const ctitle = r.campaignTitle || r.Campaign_Title;
      if (cid && !map.has(String(cid))) {
        map.set(String(cid), {
          id: String(cid),
          label: ctitle || `Campaign #${cid}`,
          sub: `#${cid}${r.orgName ? ` · ${r.orgName}` : ''}`,
          icon: 'campaign'
        });
      } else if (!cid && ctitle && !map.has(ctitle)) {
        map.set(ctitle, {
          id: ctitle,
          label: ctitle,
          sub: r.orgName || '',
          icon: 'campaign'
        });
      }
    });
    return Array.from(map.values());
  }, [isLogs, campaigns, records]);

  const campaignSelectOptions = useMemo(() => ([
    {
      id: 'ALL',
      label: `All Campaigns (${campaignOptions.length})`,
      sub: 'Include records across every campaign',
      icon: 'apps'
    },
    ...campaignOptions
  ]), [campaignOptions]);

  // Live filtered dataset
  const filteredRecords = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    const q = search.trim().toLowerCase();

    return (records || []).filter((item) => {
      // Date range filter
      if (dateRange !== 'all') {
        const dt = resolveRecordDate(item);
        if (!dt) return false;
        const ts = dt.getTime();
        if (dateRange === 'today' && ts < startOfToday.getTime()) return false;
        if (dateRange === '7d' && now - ts > 7 * 24 * 60 * 60 * 1000) return false;
        if (dateRange === '30d' && now - ts > 30 * 24 * 60 * 60 * 1000) return false;
        if (dateRange === 'year' && ts < startOfYear) return false;
        if (dateRange === 'custom') {
          if (fromMs && ts < fromMs) return false;
          if (toMs && ts > toMs) return false;
        }
      }

      if (isLogs) {
        if (logCategory !== 'ALL' && String(item.category || '').toUpperCase() !== logCategory) return false;
        if (logRole !== 'ALL' && String(item.role || '').toUpperCase() !== logRole) return false;
        if (q) {
          const hay = [
            item.activity,
            item.action,
            item.userName,
            item.actor,
            item.userEmail,
            item.target,
            item.category,
            item.role
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }

      // Financial record filters (Donor / NGO / Admin Ledger)
      if (channel !== 'ALL') {
        const rail = normalizePaymentRail(item.rail || item.paymentMethod || item.Payment_Method).toUpperCase();
        if (channel === 'GCASH' && !rail.includes('GCASH')) return false;
        if (channel === 'MAYA' && !rail.includes('MAYA')) return false;
        if (channel === 'BANK_CARD' && !rail.includes('BANK') && !rail.includes('CARD')) return false;
      }

      if (category !== 'ALL') {
        if (inferCampaignCategory(item, campaigns) !== category) return false;
      }

      if (campaignId !== 'ALL') {
        const cid = String(item.campaignId || item.Campaign_ID || item.Campaign_Title || item.campaignTitle || '');
        const ctitle = String(item.Campaign_Title || item.campaignTitle || '');
        if (cid !== campaignId && ctitle !== campaignId) return false;
      }

      if (role === 'admin_ledger' && statusFilter !== 'ALL') {
        const st = String(item.status || '').toLowerCase();
        const isVer = st.includes('verified') || st.includes('approved') || item.isNotarized;
        if (statusFilter === 'VERIFIED' && !isVer) return false;
        if (statusFilter === 'PENDING' && isVer) return false;
      }

      if (q) {
        const campObj = (campaigns || []).find((c) => String(c.id) === String(item.campaignId || item.Campaign_ID));
        const hay = [
          item.campaignTitle,
          item.Campaign_Title,
          campObj?.title,
          item.orgName,
          campObj?.orgName,
          item.donorName,
          item.Donor_Name,
          item.donorEmail,
          item.Donor_Email,
          item.txHash,
          item.refCode,
          item.paymentMethod,
          item.rail
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [records, campaigns, isLogs, role, dateRange, dateFrom, dateTo, channel, category, campaignId, statusFilter, logCategory, logRole, search]);

  const totalPhp = useMemo(() => {
    if (isLogs) return 0;
    return filteredRecords.reduce((sum, r) => sum + resolveDonationPhp(r), 0);
  }, [filteredRecords, isLogs]);

  const filterSummary = useMemo(() => {
    const parts = [];
    const drObj = DATE_RANGES.find((d) => d.id === dateRange);
    if (dateRange === 'custom' && (dateFrom || dateTo)) {
      parts.push(`${dateFrom || 'Start'} to ${dateTo || 'Now'}`);
    } else if (drObj) {
      parts.push(drObj.label);
    }
    if (isLogs) {
      if (logCategory !== 'ALL') parts.push(`Category: ${logCategory}`);
      if (logRole !== 'ALL') parts.push(`Role: ${logRole}`);
    } else {
      if (channel !== 'ALL') {
        const ch = CHANNELS.find((c) => c.id === channel);
        if (ch) parts.push(`Channel: ${ch.label}`);
      }
      if (category !== 'ALL') {
        parts.push(category === 'CD' ? 'Charitable Aid' : 'Disaster Relief');
      }
      if (campaignId !== 'ALL') {
        const co = campaignOptions.find((c) => c.id === campaignId);
        if (co) parts.push(`Campaign: ${co.label.slice(0, 32)}`);
      }
      if (role === 'admin_ledger' && statusFilter !== 'ALL') {
        parts.push(`Status: ${statusFilter}`);
      }
    }
    if (search.trim()) parts.push(`Search: "${search.trim()}"`);
    return parts.join(' · ') || 'All Records';
  }, [dateRange, dateFrom, dateTo, isLogs, logCategory, logRole, channel, category, campaignId, campaignOptions, role, statusFilter, search]);

  const handleReset = () => {
    setDateRange('all');
    setDateFrom('');
    setDateTo('');
    setChannel('ALL');
    setCategory('ALL');
    setCampaignId('ALL');
    setStatusFilter('ALL');
    setLogCategory('ALL');
    setLogRole('ALL');
    setSearch('');
  };

  const runExport = (format) => {
    if (role === 'donor') {
      const payload = {
        donorName: meta.donorName || 'Verified Donor',
        donorEmail: meta.donorEmail || '',
        donations: filteredRecords,
        campaigns,
        filterSummary
      };
      if (format === 'xlsx') {
        const f = exportDonorReportExcel(payload);
        onExported?.(`Exported ${filteredRecords.length} receipt(s) to "${f}".`, 'Excel Report Ready');
      } else if (format === 'csv') {
        const f = exportDonorReportCsv(payload);
        onExported?.(`Exported ${filteredRecords.length} receipt(s) to "${f}".`, 'CSV Report Ready');
      } else {
        exportDonorPrintableReport(payload);
        onExported?.(`Opened clean A4 PDF report (${filteredRecords.length} receipt(s)).`, 'PDF Report Ready');
      }
    } else if (role === 'ngo') {
      const payload = {
        orgName: meta.orgName || 'Verified NGO',
        donations: filteredRecords,
        campaigns,
        filterSummary
      };
      if (format === 'xlsx') {
        const f = exportNgoLedgerExcel(payload);
        onExported?.(`Exported ${filteredRecords.length} ledger record(s) to "${f}".`, 'Excel Report Ready');
      } else if (format === 'csv') {
        const f = exportNgoLedgerCsv(payload);
        onExported?.(`Exported ${filteredRecords.length} ledger record(s) to "${f}".`, 'CSV Report Ready');
      } else {
        exportNgoAuditPdf(payload);
        onExported?.(`Opened clean A4 NGO Audit PDF (${filteredRecords.length} record(s)).`, 'Audit PDF Ready');
      }
    } else if (role === 'admin_ledger') {
      if (format === 'xlsx') {
        const f = exportAdminFinancialLedgerExcel(filteredRecords, filterSummary);
        onExported?.(`Exported ${filteredRecords.length} ledger record(s) to "${f}".`, 'Excel Report Ready');
      } else if (format === 'csv') {
        const f = exportAdminFinancialLedgerCsv(filteredRecords);
        onExported?.(`Exported ${filteredRecords.length} ledger record(s) to "${f}".`, 'CSV Report Ready');
      } else {
        exportAdminFinancialLedgerPdf(filteredRecords, filterSummary);
        onExported?.(`Opened clean A4 Admin Financial Ledger PDF (${filteredRecords.length} record(s)).`, 'PDF Report Ready');
      }
    } else if (role === 'admin_logs') {
      if (format === 'xlsx') {
        const f = exportAdminActivityLogsExcel(filteredRecords, filterSummary);
        onExported?.(`Exported ${filteredRecords.length} activity log(s) to "${f}".`, 'Excel Audit Ready');
      } else if (format === 'csv') {
        const f = exportAdminActivityLogsCsv(filteredRecords);
        onExported?.(`Exported ${filteredRecords.length} activity log(s) to "${f}".`, 'CSV Audit Ready');
      } else {
        exportAdminActivityLogsPdf(filteredRecords, filterSummary);
        onExported?.(`Opened clean A4 Activity Logs PDF (${filteredRecords.length} log(s)).`, 'Audit PDF Ready');
      }
    }
    onClose?.();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fem-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="fem-dialog fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="fem-head">
          <div className="fem-head-left">
            <div className="fem-icon-badge">
              <span className="material-symbols-outlined">tune</span>
            </div>
            <div>
              <h3 className="fem-title">{title}</h3>
              <div className="fem-sub">{subtitle}</div>
            </div>
          </div>
          <button type="button" className="fem-close" onClick={onClose} aria-label="Close export modal">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="fem-body">
          {/* 1. Date Range */}
          <div>
            <span className="fem-section-lbl">1. Reporting Period</span>
            <div className="fem-chip-row">
              {DATE_RANGES.map((dr) => (
                <button
                  key={dr.id}
                  type="button"
                  className={`fem-chip ${dateRange === dr.id ? 'active' : ''}`}
                  onClick={() => setDateRange(dr.id)}
                >
                  {dr.label}
                </button>
              ))}
            </div>
            {dateRange === 'custom' && (
              <div className="fem-grid-2" style={{ marginTop: '8px' }}>
                <div>
                  <span className="fem-section-lbl" style={{ marginBottom: '3px' }}>From Date</span>
                  <input type="date" className="fem-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <span className="fem-section-lbl" style={{ marginBottom: '3px' }}>To Date</span>
                  <input type="date" className="fem-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* 2. Role-specific Filters */}
          {!isLogs ? (
            <>
              <div>
                <span className="fem-section-lbl">2. Payment Channel</span>
                <div className="fem-chip-row">
                  {CHANNELS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`fem-chip ${channel === c.id ? 'active' : ''}`}
                      onClick={() => setChannel(c.id)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fem-grid-2">
                <div>
                  <span className="fem-section-lbl">Cause Category</span>
                  <GeistSelect
                    value={category}
                    onChange={setCategory}
                    options={CATEGORIES}
                  />
                </div>

                {role === 'admin_ledger' ? (
                  <div>
                    <span className="fem-section-lbl">Verification Status</span>
                    <GeistSelect
                      value={statusFilter}
                      onChange={setStatusFilter}
                      options={STATUSES}
                      alignRight
                    />
                  </div>
                ) : (
                  <div>
                    <span className="fem-section-lbl">Campaign</span>
                    <GeistSelect
                      value={campaignId}
                      onChange={setCampaignId}
                      options={campaignSelectOptions}
                      searchable={campaignOptions.length > 5}
                      searchPlaceholder="Search campaigns by title, ID, or NGO..."
                      emptyText="No campaigns match your search"
                      alignRight
                    />
                  </div>
                )}
              </div>

              {role === 'admin_ledger' && campaignOptions.length > 0 && (
                <div>
                  <span className="fem-section-lbl">Campaign</span>
                  <GeistSelect
                    value={campaignId}
                    onChange={setCampaignId}
                    options={campaignSelectOptions}
                    searchable={campaignOptions.length > 5}
                    searchPlaceholder="Search campaigns by title, ID, or NGO..."
                    emptyText="No campaigns match your search"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="fem-grid-2">
              <div>
                <span className="fem-section-lbl">Event Category</span>
                <GeistSelect
                  value={logCategory}
                  onChange={setLogCategory}
                  options={LOG_CATEGORIES}
                />
              </div>
              <div>
                <span className="fem-section-lbl">Actor Role</span>
                <GeistSelect
                  value={logRole}
                  onChange={setLogRole}
                  options={LOG_ROLES}
                  alignRight
                />
              </div>
            </div>
          )}

          {/* 3. Keyword Search */}
          <div>
            <span className="fem-section-lbl">{isLogs ? '3. Keyword Filter (Optional)' : '3. Search Filter (Optional)'}</span>
            <input
              type="text"
              className="fem-input"
              placeholder={isLogs ? 'Filter by actor, email, activity, or target...' : 'Filter by campaign, donor, NGO, or hash...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Live Preview Count Bar */}
          <div className={`fem-preview-bar ${filteredRecords.length === 0 ? 'is-empty' : ''}`}>
            <div className="fem-preview-left">
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: filteredRecords.length > 0 ? '#10b981' : '#f59e0b' }}>
                {filteredRecords.length > 0 ? 'check_circle' : 'info'}
              </span>
              <span>
                {filteredRecords.length} of {(records || []).length} record{(records || []).length === 1 ? '' : 's'} matched
              </span>
              <button type="button" className="fem-reset-btn" onClick={handleReset}>
                Reset
              </button>
            </div>
            {!isLogs && (
              <div className="fem-preview-right">
                Total: ₱{Math.round(totalPhp).toLocaleString('en-US')}
              </div>
            )}
          </div>

          {/* 4. Choose Export Format */}
          <div>
            <span className="fem-section-lbl">4. Choose Export Format</span>
            <div className="fem-formats-grid">
              <button type="button" className="fem-format-card" onClick={() => runExport('xlsx')}>
                <div className="fem-format-top">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#10b981' }}>table_view</span>
                  <span className="fem-format-ext">.xlsx</span>
                </div>
                <span className="fem-format-name">Excel Workbook</span>
                <span className="fem-format-desc">
                  {isLogs ? 'Summary + Activity Logs (2 sheets)' : 'Summary, Ledger & Campaigns (3 sheets)'}
                </span>
              </button>

              <button type="button" className="fem-format-card" onClick={() => runExport('csv')}>
                <div className="fem-format-top">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#38bdf8' }}>description</span>
                  <span className="fem-format-ext">.csv</span>
                </div>
                <span className="fem-format-name">CSV Spreadsheet</span>
                <span className="fem-format-desc">Clean, column-aligned UTF-8 table</span>
              </button>

              <button type="button" className="fem-format-card" onClick={() => runExport('pdf')}>
                <div className="fem-format-top">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#f59e0b' }}>picture_as_pdf</span>
                  <span className="fem-format-ext">.pdf</span>
                </div>
                <span className="fem-format-name">Printable PDF</span>
                <span className="fem-format-desc">Formatted A4 executive statement</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="fem-foot">
          <span>Active scope: {filterSummary}</span>
          <button type="button" className="rcp-modal-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
