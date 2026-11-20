import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../context/ToastContext';
import DisbursementProofModal from './DisbursementProofModal';
import './NotificationCenter.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Rich text formatter to highlight important details (Amounts, ETH, Quotes, References, Legal Acts)
function renderFormattedMessage(text) {
  if (!text) return null;

  const regex = /(\*\*.*?\*\*|"[^"]+?"|₱[\d,]+(?:\.\d+)?|\b\d+(?:\.\d+)?\s*ETH\b|\bRef:\s*[\w-]+\b|\bTransaction Ref:\s*[\w-]+\b|Republic Act 11232|SEC eSPARC|Sepolia EVM|Sepolia|2FA|Solidity|Approved|Rejected|Verified)/g;

  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="bbdrts-notif-highlight">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('"') && part.endsWith('"')) {
      return <strong key={index} className="bbdrts-notif-campaign-title">{part}</strong>;
    }
    if (
      part.startsWith('₱') ||
      part.includes('ETH') ||
      part.startsWith('Ref:') ||
      part.startsWith('Transaction Ref:') ||
      part === 'Republic Act 11232' ||
      part === 'SEC eSPARC' ||
      part === 'Sepolia EVM' ||
      part === 'Sepolia' ||
      part === '2FA' ||
      part === 'Solidity' ||
      part === 'Approved' ||
      part === 'Rejected' ||
      part === 'Verified'
    ) {
      return <strong key={index} className="bbdrts-notif-highlight">{part}</strong>;
    }
    return part;
  });
}

// Robust helper to extract campaign information from notification payloads
function extractCampaignInfo(notif) {
  if (!notif) return null;
  let campaignId = null;
  const link = String(notif.link || '');

  // 1. Query parameter: e.g. /campaigns?campaign=4
  const queryMatch = link.match(/[?&]campaign=([0-9]+)/i);
  if (queryMatch) {
    campaignId = Number(queryMatch[1]);
  }

  // 2. Hash / Path format: e.g. #campaign-4 or /campaigns/4
  if (!campaignId) {
    const hashMatch = link.match(/#campaign-?([0-9]+)/i) || link.match(/\/campaigns\/([0-9]+)/i);
    if (hashMatch) {
      campaignId = Number(hashMatch[1]);
    }
  }

  // 3. Reference ID when type is campaign
  if (!campaignId && (notif.referenceType === 'CAMPAIGN' || notif.reference_type === 'CAMPAIGN')) {
    if (/^[0-9]+$/.test(String(notif.referenceId || '').trim())) {
      campaignId = Number(notif.referenceId);
    }
  }

  // 4. Clean campaign title from notification title
  let cleanTitle = String(notif.title || '')
    .replace(/^Relief Disbursed:\s*/i, '')
    .replace(/^Proof of Relief:\s*/i, '')
    .replace(/^Disbursement Milestone:\s*/i, '')
    .replace(/^Funds Disbursed:\s*/i, '')
    .trim();

  return {
    id: campaignId,
    Campaign_ID: campaignId,
    title: cleanTitle || 'Relief Campaign',
    Campaign_Title: cleanTitle || 'Relief Campaign',
    referenceId: notif.referenceId,
    txHash: notif.referenceId && String(notif.referenceId).startsWith('0x') ? notif.referenceId : null
  };
}

export default function NotificationCenter({ dbUser, theme, onSelectNotificationAction }) {
  const { showSuccess, showWarning, showInfo, showError } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [selectedNotif, setSelectedNotif] = useState(null); // Active Detail Card Modal
  const [proofModalCamp, setProofModalCamp] = useState(null); // Active relief proof modal
  const [activeMenuId, setActiveMenuId] = useState(null); // 3-dots menu per item
  const [currentTime, setCurrentTime] = useState(Date.now()); // Real-time timestamp ticker
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const panelRef = useRef(null);
  const filterCacheRef = useRef({});
  const activeFilterRef = useRef(filter);
  activeFilterRef.current = filter;

  // Instant 0ms local filter helper derived from cached 'all' inbox items
  const deriveInstantFiltered = (targetFilter) => {
    const exact = filterCacheRef.current[targetFilter];
    if (exact && Array.isArray(exact.items)) return exact.items;
    if (targetFilter === 'trash') return [];
    const allItems = filterCacheRef.current.all?.items;
    if (!Array.isArray(allItems)) return null;
    if (targetFilter === 'all') return allItems;
    if (targetFilter === 'unread') return allItems.filter(n => !n.isRead && !n.isDeleted);
    const upper = String(targetFilter).toUpperCase();
    return allItems.filter(n => {
      const t = String(n.type || n.category || '').toUpperCase();
      return t === upper || t.includes(upper);
    });
  };

  // Handle opening relief proofs directly from notification
  const handleViewProofs = async (notif) => {
    let camp = extractCampaignInfo(notif);

    // If campaign ID was not extracted directly, query /api/campaigns to resolve by title
    if (!camp?.id) {
      try {
        const res = await fetch(`${API_URL}/api/campaigns`);
        if (res.ok) {
          const camps = await res.json();
          const targetTitle = String(camp?.title || '').toLowerCase().trim();
          const found = (Array.isArray(camps) ? camps : []).find(c => {
            const ct = String(c.title || c.Campaign_Title || '').toLowerCase().trim();
            return ct && (ct === targetTitle || ct.includes(targetTitle) || targetTitle.includes(ct));
          });
          if (found) {
            camp = {
              ...found,
              id: found.id || found.Campaign_ID,
              Campaign_ID: found.id || found.Campaign_ID,
              title: found.title || found.Campaign_Title,
              Campaign_Title: found.title || found.Campaign_Title,
              orgName: found.orgName || found.Org_Name
            };
          }
        }
      } catch (err) {
        console.warn('Could not resolve campaign by title:', err);
      }
    }

    if (camp && (camp.id || camp.Campaign_ID)) {
      setSelectedNotif(null);
      setIsOpen(false);
      setProofModalCamp(camp);
      window.dispatchEvent(new CustomEvent('bbdrts_open_proof_modal', {
        detail: { campaign: camp, campaignId: camp.id || camp.Campaign_ID, notif }
      }));
    } else {
      setSelectedNotif(null);
      setIsOpen(false);
      if (onSelectNotificationAction) {
        onSelectNotificationAction(notif);
      }
    }
  };

  // Dynamic category filter chips strictly role-specific (Inbox only)
  const getFilterChips = () => {
    const role = (dbUser?.role || 'donor').toLowerCase();
    if (role === 'donor') {
      return [
        { id: 'all', label: 'All' },
        { id: 'unread', label: 'Unread', count: unreadCount },
        { id: 'DONATION', label: 'Donations' },
        { id: 'MILESTONE', label: 'Relief Proofs' },
        { id: 'SECURITY', label: 'Security' },
        { id: 'SYSTEM', label: 'System' }
      ];
    }
    if (role === 'organization') {
      return [
        { id: 'all', label: 'All' },
        { id: 'unread', label: 'Unread', count: unreadCount },
        { id: 'DONATION', label: 'Donations' },
        { id: 'CAMPAIGN', label: 'Campaigns' },
        { id: 'VERIFICATION', label: 'SEC Accreditation' },
        { id: 'SECURITY', label: 'Security' }
      ];
    }
    // Admin
    return [
      { id: 'all', label: 'All' },
      { id: 'unread', label: 'Unread', count: unreadCount },
      { id: 'DONATION', label: 'Ledger' },
      { id: 'CAMPAIGN', label: 'Campaigns' },
      { id: 'VERIFICATION', label: 'KYC Approvals' },
      { id: 'BROADCAST', label: 'Broadcasts' },
      { id: 'SECURITY', label: 'Security' },
      { id: 'SYSTEM', label: 'System' }
    ];
  };

  // Live real-time polling with instant per-filter caching & stale-while-revalidate
  const fetchNotifications = async (pageNum = 1, append = false, currentFilter = filter, silentPrefetch = false) => {
    const token = localStorage.getItem('bbdrts_token');
    try {
      const url = `${API_URL}/api/notifications?page=${pageNum}&limit=20&filter=${encodeURIComponent(currentFilter)}`;
      const res = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        const notifList = Array.isArray(data) ? data : (data.notifications || []);
        const unread = data.unreadCount !== undefined ? data.unreadCount : notifList.filter(n => !n.isRead && !n.isDeleted).length;
        const total = data.totalCount !== undefined ? data.totalCount : notifList.length;
        const trash = data.trashCount !== undefined ? data.trashCount : 0;

        setUnreadCount(unread);
        setTotalCount(total);
        setTrashCount(trash);

        // Always update cache for this filter
        if (!append) {
          const prevCached = filterCacheRef.current[currentFilter]?.items || [];
          let nextCached = notifList;
          if (prevCached.length > 20 && pageNum === 1) {
            const freshMap = new Map(notifList.map(n => [n.id, n]));
            const updated = prevCached.map(p => freshMap.get(p.id) || p);
            const prevIds = new Set(prevCached.map(p => p.id));
            const brandNew = notifList.filter(n => !prevIds.has(n.id));
            nextCached = [...brandNew, ...updated];
          }
          filterCacheRef.current[currentFilter] = { items: nextCached, hasMore: Boolean(data.hasMore) };
        }

        // Ignore UI update if this was a background prefetch or user already switched to another tab
        if (silentPrefetch || activeFilterRef.current !== currentFilter) return;

        if (append) {
          setNotifications(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const fresh = notifList.filter(n => !existingIds.has(n.id));
            const merged = [...prev, ...fresh];
            filterCacheRef.current[currentFilter] = { items: merged, hasMore: Boolean(data.hasMore) };
            return merged;
          });
          setPage(pageNum);
          setHasMore(Boolean(data.hasMore));
        } else {
          setNotifications(filterCacheRef.current[currentFilter].items);
          setHasMore(Boolean(data.hasMore));
          setPage(1);
        }
      }
    } catch (err) {
      console.warn('Live notification sync fallback:', err);
    }
  };

  // Instant 0ms tab/category/trash switch from cache + background sync
  useEffect(() => {
    if (!dbUser) return;
    setPage(1);
    const instant = deriveInstantFiltered(filter);
    if (instant !== null) {
      setNotifications(instant);
      setHasMore(Boolean(filterCacheRef.current[filter]?.hasMore));
    }
    fetchNotifications(1, false, filter);
    const pollInterval = setInterval(() => {
      fetchNotifications(1, false, filter);
    }, 4000);
    return () => clearInterval(pollInterval);
  }, [dbUser, filter]);

  // Silently prefetch Trash & Inbox when panel opens so switching Inbox <-> Trash is 0ms instant
  useEffect(() => {
    if (!isOpen || !dbUser) return;
    if (filter !== 'trash') fetchNotifications(1, false, 'trash', true);
    if (filter !== 'all') fetchNotifications(1, false, 'all', true);
  }, [isOpen, dbUser]);

  // Real-time progressive clock ticker (updates relative time every 3s)
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 3000);
    return () => clearInterval(clockInterval);
  }, []);

  // Close dropdown when clicking outside (Modal clicks & dropdown clicks never close dropdown)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectedNotif) return;
      if (e.target.closest('.bbdrts-notif-modal-backdrop') || e.target.closest('.bbdrts-notif-card-modal')) {
        return;
      }
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
        setActiveMenuId(null);
      }
    };
    if (isOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, selectedNotif]);

  // Mark all notifications as read for current user
  const handleMarkAllAsRead = async () => {
    const token = localStorage.getItem('bbdrts_token');
    // Optimistic UI update
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    showSuccess('All notifications marked as read.', 'Inbox Updated');
    try {
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Clicking an item opens the modal popup WITHOUT closing the dropdown
  const handleItemClick = async (notif) => {
    if (!notif.isDeleted && !notif.isRead) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      const token = localStorage.getItem('bbdrts_token');
      try {
        await fetch(`${API_URL}/api/notifications/${notif.id}/read`, {
          method: 'POST',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
      } catch (_) {}
    }

    setSelectedNotif(notif.isDeleted ? notif : { ...notif, isRead: true });
    setActiveMenuId(null);
  };

  // Toggle single item read / unread status
  const handleToggleReadStatus = async (e, notif) => {
    if (e) e.stopPropagation();
    setActiveMenuId(null);
    const newStatus = !notif.isRead;

    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: newStatus } : n));
    setUnreadCount(prev => newStatus ? Math.max(0, prev - 1) : prev + 1);
    if (selectedNotif && selectedNotif.id === notif.id) {
      setSelectedNotif(prev => ({ ...prev, isRead: newStatus }));
    }

    const token = localStorage.getItem('bbdrts_token');
    try {
      const endpoint = newStatus ? `/api/notifications/${notif.id}/read` : `/api/notifications/${notif.id}/unread`;
      await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
    } catch (err) {
      console.error('Failed to toggle read status:', err);
    }
  };

  // Move to 30-Day Trash Bin (Soft Delete) with Bottom-Right Undo Toast
  const handleMoveToTrash = async (e, notif) => {
    if (e) e.stopPropagation();
    setActiveMenuId(null);

    // Optimistic removal from inbox
    if (!notif.isRead) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    setTrashCount(prev => prev + 1);
    setNotifications(prev => prev.filter(n => n.id !== notif.id));
    if (selectedNotif && selectedNotif.id === notif.id) {
      setSelectedNotif(null);
    }

    // Trigger Bottom-Right Global Toast with Undo button
    showWarning(
      'Moved to Trash (30-day retention)',
      'Notification Trashed',
      6000,
      {
        label: 'Undo',
        onClick: () => handleRestore(null, notif)
      },
      'delete'
    );

    const token = localStorage.getItem('bbdrts_token');
    try {
      await fetch(`${API_URL}/api/notifications/${notif.id}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
    } catch (err) {
      console.error('Failed to move notification to trash:', err);
    }
  };

  // Restore notification from Trash (Keeps Read/Unread State Intact)
  const handleRestore = async (e, notif) => {
    if (e) e.stopPropagation();
    setActiveMenuId(null);

    // Optimistic update
    setTrashCount(prev => Math.max(0, prev - 1));
    if (filter === 'trash') {
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
    } else {
      setNotifications(prev => [notif, ...prev.filter(n => n.id !== notif.id)]);
      if (!notif.isRead) {
        setUnreadCount(prev => prev + 1);
      }
    }
    if (selectedNotif && selectedNotif.id === notif.id) {
      setSelectedNotif(null);
    }

    showSuccess('Notification restored to Inbox.', 'Notification Restored');

    const token = localStorage.getItem('bbdrts_token');
    try {
      await fetch(`${API_URL}/api/notifications/${notif.id}/restore`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      fetchNotifications(1, false, filter);
    } catch (err) {
      console.error('Failed to restore notification:', err);
    }
  };

  // Permanent Delete (Trash Only)
  const handlePermanentDelete = async (e, notifId) => {
    if (e) e.stopPropagation();
    setActiveMenuId(null);

    setTrashCount(prev => Math.max(0, prev - 1));
    setNotifications(prev => prev.filter(n => n.id !== notifId));
    if (selectedNotif && selectedNotif.id === notifId) {
      setSelectedNotif(null);
    }

    showInfo('Notification permanently deleted.', 'Deleted');

    const token = localStorage.getItem('bbdrts_token');
    try {
      await fetch(`${API_URL}/api/notifications/${notifId}/permanent`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
    } catch (err) {
      console.error('Failed to permanently delete notification:', err);
    }
  };

  // Empty All Items from Trash
  const handleEmptyTrash = async () => {
    if (!window.confirm('Permanently delete all items in Trash?')) return;
    setNotifications([]);
    setTrashCount(0);
    showSuccess('Trash emptied permanently.', 'Trash Emptied');

    const token = localStorage.getItem('bbdrts_token');
    try {
      await fetch(`${API_URL}/api/notifications/trash/empty`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
    } catch (err) {
      console.error('Failed to empty trash:', err);
    }
  };

  // Copy notification text to clipboard
  const handleCopyText = (e, text) => {
    if (e) e.stopPropagation();
    setActiveMenuId(null);
    navigator.clipboard.writeText(text);
    showSuccess('Notification text copied to clipboard!', 'Copied');
  };

  // Load more notifications
  const handleLoadMore = async (e) => {
    if (e) e.stopPropagation();
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    await fetchNotifications(page + 1, true, filter);
    setIsLoadingMore(false);
  };

  // Icon mapping
  const getTypeIcon = (type) => {
    const t = (type || '').toUpperCase();
    switch (t) {
      case 'DONATION': return 'payments';
      case 'DISBURSEMENT': return 'volunteer_activism';
      case 'CAMPAIGN': return 'campaign';
      case 'MILESTONE':
      case 'RELIEF_PROOF': return 'verified';
      case 'VERIFICATION':
      case 'KYC': return 'verified_user';
      case 'SECURITY': return 'shield';
      case 'ACCOUNT': return 'person';
      case 'WITHDRAWAL': return 'account_balance_wallet';
      case 'EMERGENCY': return 'warning';
      case 'BROADCAST': return 'podcasts';
      default: return 'notifications';
    }
  };

  // Color mapping
  const getTypeColor = (type) => {
    const t = (type || '').toUpperCase();
    switch (t) {
      case 'DONATION': return '#10b981';
      case 'DISBURSEMENT': return '#10b981';
      case 'CAMPAIGN': return '#f59e0b';
      case 'MILESTONE':
      case 'RELIEF_PROOF': return '#10b981';
      case 'VERIFICATION':
      case 'KYC': return '#38bdf8';
      case 'SECURITY': return '#a855f7';
      case 'ACCOUNT': return '#ec4899';
      case 'WITHDRAWAL': return '#10b981';
      case 'EMERGENCY': return '#ef4444';
      case 'BROADCAST': return '#06b6d4';
      default: return 'var(--accent, #10b981)';
    }
  };

  // User-friendly label
  const getTypeLabel = (type) => {
    const t = (type || '').toUpperCase();
    switch (t) {
      case 'DONATION': return 'Donation Activity';
      case 'DISBURSEMENT': return 'Relief Disbursed to Beneficiaries';
      case 'CAMPAIGN': return 'Disaster Relief Campaign';
      case 'MILESTONE': return 'Relief Milestone Verified';
      case 'RELIEF_PROOF': return 'Proof-of-Delivery Evidence';
      case 'VERIFICATION':
      case 'KYC': return 'SEC Accreditation & Governance';
      case 'SECURITY': return 'Protocol Security Alert';
      case 'ACCOUNT': return 'Account Lifecycle';
      case 'WITHDRAWAL': return 'Relief Disbursement';
      case 'EMERGENCY': return 'Emergency Alert';
      case 'BROADCAST': return 'Broadcast Announcement';
      default: return 'Platform Notice';
    }
  };

  // Compact tag label for notification list item
  const getTypeShortLabel = (type) => {
    const t = (type || '').toUpperCase();
    switch (t) {
      case 'DONATION': return 'Donation';
      case 'DISBURSEMENT': return 'Disbursement';
      case 'CAMPAIGN': return 'Campaign';
      case 'MILESTONE': return 'Milestone';
      case 'RELIEF_PROOF': return 'Relief Proof';
      case 'VERIFICATION':
      case 'KYC': return 'SEC Accreditation';
      case 'SECURITY': return 'Security';
      case 'ACCOUNT': return 'Account';
      case 'WITHDRAWAL': return 'Disbursement';
      case 'EMERGENCY': return 'Emergency';
      case 'BROADCAST': return 'Broadcast';
      default: return 'System Notice';
    }
  };

  // Action button configuration for Detail Card Modal (context-aware for NGO, Donor, Admin)
  const getCardActionButton = () => {
    if (!selectedNotif) return null;
    const role = (dbUser?.role || 'donor').toLowerCase();
    const type = (selectedNotif.type || '').toUpperCase();

    if (type === 'DONATION' || type === 'WITHDRAWAL') {
      return {
        icon: 'receipt_long',
        label: role === 'donor' ? 'View My Donations' : 'View Financial Ledger'
      };
    }
    if (type === 'CAMPAIGN') {
      return {
        icon: 'campaign',
        label: role === 'organization' ? 'Manage My Campaigns' : 'View Relief Campaigns'
      };
    }
    if (type === 'DISBURSEMENT' || type === 'MILESTONE' || type === 'RELIEF_PROOF') {
      return {
        icon: 'volunteer_activism',
        label: role === 'admin' ? 'Audit Disbursements' : (role === 'organization' ? 'View Campaigns & Proofs' : 'View Relief Proofs')
      };
    }
    if (type === 'VERIFICATION' || type === 'KYC') {
      return {
        icon: 'verified_user',
        label: role === 'admin' ? 'Review KYC Approvals' : (role === 'organization' ? 'View SEC Accreditation' : 'View Accredited NGOs')
      };
    }
    if (type === 'SECURITY') {
      return {
        icon: 'shield',
        label: 'Security Settings'
      };
    }
    if (type === 'EMERGENCY' || type === 'BROADCAST') {
      return {
        icon: 'podcasts',
        label: role === 'admin' ? 'Manage Broadcasts' : 'View Relief Radar'
      };
    }
    return {
      icon: 'open_in_new',
      label: role === 'admin' ? 'View Activity Logs' : 'View Dashboard'
    };
  };

  // Dynamic Relative Time Formatter (authoritative database timestamp vs live clock)
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Just now';
    let timestamp = new Date(dateStr).getTime();
    if (isNaN(timestamp)) {
      let clean = String(dateStr).trim().replace(' ', 'T');
      if (!clean.endsWith('Z') && !clean.includes('+')) clean += 'Z';
      timestamp = new Date(clean).getTime();
    }
    if (isNaN(timestamp)) return 'Just now';

    const diffInSeconds = Math.max(0, Math.floor((currentTime - timestamp) / 1000));

    if (diffInSeconds < 45) return 'Just now';
    if (diffInSeconds < 90) return '1m ago';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;

    const diffInHours = Math.floor(diffInSeconds / 3600);
    if (diffInHours === 1) return '1h ago';
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInSeconds / 86400);
    if (diffInDays === 1) return '1d ago';
    if (diffInDays < 7) return `${diffInDays}d ago`;

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks === 1) return '1w ago';
    if (diffInWeeks < 4) return `${diffInWeeks}w ago`;

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths === 1) return '1mo ago';
    if (diffInMonths < 12) return `${diffInMonths}mo ago`;

    const diffInYears = Math.floor(diffInDays / 365);
    if (diffInYears === 1) return '1y ago';
    return `${diffInYears}y ago`;
  };

  // Full formatted exact date in user's local timezone
  const formatExactDate = (dateStr) => {
    if (!dateStr) return new Date().toLocaleString();
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (_) {
      return dateStr;
    }
  };

  if (!dbUser) return null;

  return (
    <div className="bbdrts-notif-container" ref={panelRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        className={`bbdrts-notif-btn ${isOpen ? 'active' : ''}`}
        onClick={() => {
          setIsOpen(prev => !prev);
          setActiveMenuId(null);
        }}
        title="Protocol Notifications & Alerts"
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined bbdrts-notif-icon">notifications</span>
        {unreadCount > 0 && (
          <span className="bbdrts-notif-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Ambient Background Scrim with Soft Blur when Notifications Dropdown is Open ── */}
      {isOpen && !selectedNotif && typeof document !== 'undefined' && createPortal(
        <div
          className="bbdrts-notif-dropdown-backdrop"
          onClick={() => {
            setIsOpen(false);
            setActiveMenuId(null);
          }}
          aria-hidden="true"
        />,
        document.body
      )}

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="bbdrts-notif-panel" data-theme={theme}>
          {/* Vercel-Style Panel Header */}
          <div className="bbdrts-notif-header">
            <div className="bbdrts-notif-header-title">
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: filter === 'trash' ? '#f59e0b' : 'var(--accent, #10b981)' }}>
                {filter === 'trash' ? 'auto_delete' : 'notifications'}
              </span>
              <strong>{filter === 'trash' ? 'Trash Bin' : 'Notifications'}</strong>
              {filter !== 'trash' && unreadCount > 0 && (
                <span className="bbdrts-notif-unread-pill">{unreadCount} New</span>
              )}
            </div>

            {/* Header Actions: Single clear controls */}
            <div className="bbdrts-notif-header-actions">
              {filter !== 'trash' ? (
                <>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="bbdrts-notif-mark-btn"
                      onClick={handleMarkAllAsRead}
                      title="Mark all notifications as read"
                    >
                      Mark all read
                    </button>
                  )}

                  <button
                    type="button"
                    className="bbdrts-notif-trash-toggle-btn"
                    onClick={() => {
                      setFilter('trash');
                      setActiveMenuId(null);
                    }}
                    title={`Open Trash Bin (${trashCount} items, 30d auto-purge)`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>delete</span>
                    <span>Trash</span>
                    {trashCount > 0 && (
                      <span className="bbdrts-trash-count-badge">{trashCount}</span>
                    )}
                  </button>
                </>
              ) : (
                <>
                  {trashCount > 0 && (
                    <button
                      type="button"
                      className="bbdrts-notif-empty-trash-btn-header"
                      onClick={handleEmptyTrash}
                      title="Permanently delete all items in trash"
                    >
                      Empty Trash
                    </button>
                  )}

                  <button
                    type="button"
                    className="bbdrts-notif-inbox-return-btn"
                    onClick={() => {
                      setFilter('all');
                      setActiveMenuId(null);
                    }}
                    title="Return to Notifications Inbox"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>inbox</span>
                    <span>Inbox</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Consistent Fixed-Height Sub-Bar: Filter Chips or Trash Info */}
          <div className="bbdrts-notif-subbar-fixed">
            {filter === 'trash' ? (
              <div className="bbdrts-notif-trash-bar-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#f59e0b' }}>schedule</span>
                  <span className="bbdrts-trash-hint-text">Auto-purged after 30 days</span>
                </div>
                <span className="bbdrts-trash-count-pill">
                  {trashCount} {trashCount === 1 ? 'item' : 'items'}
                </span>
              </div>
            ) : (
              <div className="bbdrts-notif-filters">
                {getFilterChips().map(chip => (
                  <button
                    key={chip.id}
                    type="button"
                    className={`bbdrts-notif-filter-chip ${filter === chip.id ? 'active' : ''}`}
                    onClick={() => {
                      setFilter(chip.id);
                      setActiveMenuId(null);
                    }}
                  >
                    <span>{chip.label}</span>
                    {chip.count !== undefined && chip.count > 0 && (
                      <span className="bbdrts-chip-num">{chip.count}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notification List */}
          <div className="bbdrts-notif-list">
            {notifications.length === 0 ? (
              <div className="bbdrts-notif-empty">
                <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--text-muted)' }}>
                  {filter === 'trash' ? 'delete_sweep' : 'notifications_off'}
                </span>
                <p>No {filter !== 'all' ? (filter === 'trash' ? 'deleted' : filter.toLowerCase()) : ''} notifications.</p>
                <span>
                  {filter === 'trash'
                    ? 'Trash is empty. Deleted notifications will appear here for 30 days.'
                    : 'You are completely up to date with protocol events.'}
                </span>
              </div>
            ) : (
              <>
                {notifications.map((n, idx) => {
                  // For row 1, 2, 3... expand menu upwards (align-bottom) so it NEVER cuts off at the bottom!
                  const isAlignBottom = idx > 0;
                  const isMenuActive = activeMenuId === n.id;
                  const inTrash = Boolean(n.isDeleted);

                  return (
                    <div
                      key={n.id}
                      className={`bbdrts-notif-item ${!n.isRead && !inTrash ? 'unread' : 'is-read'} ${isMenuActive ? 'menu-active' : ''} ${inTrash ? 'in-trash' : ''}`}
                      onClick={() => handleItemClick(n)}
                    >
                      <div
                        className="bbdrts-notif-item-icon"
                        style={{
                          backgroundColor: inTrash ? 'rgba(239, 68, 68, 0.1)' : `${getTypeColor(n.type)}18`,
                          color: inTrash ? '#ef4444' : getTypeColor(n.type),
                          borderColor: inTrash ? 'rgba(239, 68, 68, 0.3)' : `${getTypeColor(n.type)}35`
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                          {inTrash ? 'delete' : getTypeIcon(n.type)}
                        </span>
                      </div>

                      <div className="bbdrts-notif-item-content">
                        <div className="bbdrts-notif-item-header">
                          <strong className="bbdrts-notif-item-title">{n.title}</strong>
                          {inTrash ? (
                            <span className="bbdrts-notif-item-trash-pill" title={`Deleted on ${formatExactDate(n.deletedAt)}`}>
                              {n.daysRemaining !== undefined ? `${n.daysRemaining}d left` : '30d left'}
                            </span>
                          ) : (
                            <span
                              className="bbdrts-notif-item-time"
                              title={formatExactDate(n.createdAt)}
                            >
                              {formatTimeAgo(n.createdAt)}
                            </span>
                          )}
                        </div>

                        <p className="bbdrts-notif-item-desc">
                          {renderFormattedMessage(n.message)}
                        </p>

                        <div className="bbdrts-notif-item-footer">
                          <span className="bbdrts-notif-tag" style={{ color: inTrash ? '#a3a3a3' : getTypeColor(n.type) }}>
                            ● {getTypeShortLabel(n.type)}
                          </span>
                          {n.referenceId && (
                            <span className="bbdrts-notif-ref-tag">
                              Ref: #{String(n.referenceId).substring(0, 16)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Unread Visual Indicator Bullet (Only when not in trash) */}
                      {!n.isRead && !inTrash && (
                        <span className="bbdrts-notif-dot" title="Unread notification" />
                      )}

                      {/* 3-Dots Action Button */}
                      <div
                        className="bbdrts-notif-actions-wrapper"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className={`bbdrts-notif-more-btn ${isMenuActive ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(prev => prev === n.id ? null : n.id);
                          }}
                          aria-label="Options"
                        >
                          <span className="material-symbols-outlined">more_vert</span>
                        </button>

                        {/* 3-Dots Dropdown Menu */}
                        {isMenuActive && (
                          <div
                            className={`bbdrts-notif-menu-dropdown ${isAlignBottom ? 'align-bottom' : ''}`}
                            onClick={e => e.stopPropagation()}
                          >
                            {!inTrash ? (
                              <>
                                <button
                                  type="button"
                                  className="bbdrts-notif-menu-item"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    const type = (n?.type || '').toUpperCase();
                                    if (type === 'DISBURSEMENT' || type === 'MILESTONE' || type === 'RELIEF_PROOF') {
                                      handleViewProofs(n);
                                      return;
                                    }
                                    setIsOpen(false);
                                    if (onSelectNotificationAction) {
                                      onSelectNotificationAction(n);
                                    }
                                  }}
                                >
                                  <span className="material-symbols-outlined">launch</span>
                                  <span>Open Related View</span>
                                </button>

                                <button
                                  type="button"
                                  className="bbdrts-notif-menu-item"
                                  onClick={(e) => handleToggleReadStatus(e, n)}
                                >
                                  <span className="material-symbols-outlined">
                                    {n.isRead ? 'mark_chat_unread' : 'mark_chat_read'}
                                  </span>
                                  <span>{n.isRead ? 'Mark as Unread' : 'Mark as Read'}</span>
                                </button>

                                <button
                                  type="button"
                                  className="bbdrts-notif-menu-item"
                                  onClick={(e) => handleCopyText(e, `${n.title}\n${n.message}`)}
                                >
                                  <span className="material-symbols-outlined">content_copy</span>
                                  <span>Copy Message</span>
                                </button>

                                <button
                                  type="button"
                                  className="bbdrts-notif-menu-item delete"
                                  onClick={(e) => handleMoveToTrash(e, n)}
                                >
                                  <span className="material-symbols-outlined">delete</span>
                                  <span>Move to Trash</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="bbdrts-notif-menu-item restore"
                                  onClick={(e) => handleRestore(e, n)}
                                >
                                  <span className="material-symbols-outlined" style={{ color: 'var(--accent, #22c55e)' }}>
                                    restore_from_trash
                                  </span>
                                  <span>Restore to Inbox</span>
                                </button>

                                <button
                                  type="button"
                                  className="bbdrts-notif-menu-item"
                                  onClick={(e) => handleCopyText(e, `${n.title}\n${n.message}`)}
                                >
                                  <span className="material-symbols-outlined">content_copy</span>
                                  <span>Copy Message</span>
                                </button>

                                <button
                                  type="button"
                                  className="bbdrts-notif-menu-item delete"
                                  onClick={(e) => handlePermanentDelete(e, n.id)}
                                >
                                  <span className="material-symbols-outlined">delete_forever</span>
                                  <span>Delete Forever</span>
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}

                {/* Load More Pagination */}
                {hasMore && (
                  <div className="bbdrts-notif-load-more-row">
                    <button
                      type="button"
                      className="bbdrts-notif-load-more-btn"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? 'Loading...' : 'Load older notifications'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Standard Consistent Notification Detail Card Modal (Portaled to Escape Header Stacking Context) ── */}
      {selectedNotif && typeof document !== 'undefined' && createPortal(
        <div className="bbdrts-notif-modal-backdrop" onClick={() => setSelectedNotif(null)}>
          <div className="bbdrts-notif-card-modal" onClick={e => e.stopPropagation()} data-theme={theme}>
            
            {/* Modal Header — Clean Category Pill + Close */}
            <div className="bbdrts-notif-card-header">
              <div className="bbdrts-notif-card-badge-row">
                <span
                  className="bbdrts-notif-card-type-pill"
                  style={{
                    backgroundColor: selectedNotif.isDeleted ? 'rgba(239, 68, 68, 0.15)' : `${getTypeColor(selectedNotif.type)}20`,
                    color: selectedNotif.isDeleted ? '#ef4444' : getTypeColor(selectedNotif.type),
                    borderColor: selectedNotif.isDeleted ? 'rgba(239, 68, 68, 0.3)' : `${getTypeColor(selectedNotif.type)}40`
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                    {selectedNotif.isDeleted ? 'delete' : getTypeIcon(selectedNotif.type)}
                  </span>
                  {selectedNotif.isDeleted ? 'In Trash Bin' : getTypeLabel(selectedNotif.type)}
                </span>

                {selectedNotif.isDeleted && (
                  <span className="bbdrts-notif-card-trash-timer-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>schedule</span>
                    <span>{selectedNotif.daysRemaining !== undefined ? `${selectedNotif.daysRemaining} days left` : '30 days left'}</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                className="bbdrts-notif-card-close-btn"
                onClick={() => setSelectedNotif(null)}
                aria-label="Close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="bbdrts-notif-card-body">
              <h3 className="bbdrts-notif-card-title">{selectedNotif.title}</h3>

              <div className="bbdrts-notif-card-meta">
                <span className="bbdrts-notif-card-meta-item">
                  <span className="material-symbols-outlined">schedule</span>
                  {formatTimeAgo(selectedNotif.createdAt)}
                </span>
                <span className="bbdrts-notif-card-meta-item">
                  <span className="material-symbols-outlined">calendar_today</span>
                  {formatExactDate(selectedNotif.createdAt)}
                </span>
                {selectedNotif.referenceId && (
                  <span
                    className="bbdrts-notif-card-meta-item ref"
                    title={`Click to copy: ${selectedNotif.referenceId}`}
                    onClick={() => {
                      navigator.clipboard?.writeText(selectedNotif.referenceId);
                      showSuccess('Reference hash copied to clipboard!', 'Copied');
                    }}
                    style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                  >
                    <span className="material-symbols-outlined">tag</span>
                    <span>
                      Ref: {selectedNotif.referenceId.length > 22
                        ? `${selectedNotif.referenceId.slice(0, 10)}...${selectedNotif.referenceId.slice(-8)}`
                        : selectedNotif.referenceId}
                    </span>
                    <span className="material-symbols-outlined" style={{ fontSize: '13px', opacity: 0.7 }}>content_copy</span>
                  </span>
                )}
              </div>

              <div className="bbdrts-notif-card-message-box">
                <p>{renderFormattedMessage(selectedNotif.message)}</p>
              </div>

              {/* 30-Day Trash Warning or Protocol Security Stamp */}
              {selectedNotif.isDeleted ? (
                <div className="bbdrts-notif-trash-notice-box">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#f59e0b' }}>auto_delete</span>
                  <div>
                    <strong>Temporary 30-Day Trash Bin</strong>
                    <p>This notification is stored in Trash. You can restore it to your inbox anytime within 30 days. After 30 days, it is permanently deleted.</p>
                  </div>
                </div>
              ) : (
                <div className="bbdrts-notif-card-security-stamp">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--accent, #22c55e)' }}>verified</span>
                  <span>Cryptographically Anchored Event • Philippine BBDRTS Protocol</span>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="bbdrts-notif-card-footer">
              {!selectedNotif.isDeleted ? (
                <>
                  {/* Left Side: Minimalist Trash Icon Button */}
                  <button
                    type="button"
                    className="bbdrts-notif-card-action-icon-btn delete-btn"
                    onClick={(e) => handleMoveToTrash(e, selectedNotif)}
                    title="Move to Trash"
                    aria-label="Move to Trash"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>

                  <div className="bbdrts-notif-card-footer-right">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={(e) => handleToggleReadStatus(e, selectedNotif)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                        {selectedNotif.isRead ? 'mark_chat_unread' : 'mark_chat_read'}
                      </span>
                      {selectedNotif.isRead ? 'Mark as Unread' : 'Mark as Read'}
                    </button>

                    {(() => {
                      const actionCfg = getCardActionButton();
                      if (!actionCfg) return null;
                      return (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            const target = selectedNotif;
                            const type = (target?.type || '').toUpperCase();
                            if (type === 'DISBURSEMENT' || type === 'MILESTONE' || type === 'RELIEF_PROOF') {
                              handleViewProofs(target);
                              return;
                            }
                            setSelectedNotif(null);
                            setIsOpen(false);
                            if (onSelectNotificationAction) {
                              onSelectNotificationAction(target);
                            }
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 600
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                            {actionCfg.icon}
                          </span>
                          <span>{actionCfg.label}</span>
                        </button>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <>
                  {/* Left Side: Delete Forever Icon Button */}
                  <button
                    type="button"
                    className="bbdrts-notif-card-action-icon-btn delete-btn"
                    onClick={(e) => handlePermanentDelete(e, selectedNotif.id)}
                    title="Delete Forever"
                    aria-label="Delete Forever"
                  >
                    <span className="material-symbols-outlined">delete_forever</span>
                  </button>

                  <div className="bbdrts-notif-card-footer-right">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={(e) => handleRestore(e, selectedNotif)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>restore_from_trash</span>
                      Restore to Inbox
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ── Verified Aid Distribution Proof & Receipts Modal (Contextual to Notifications) ── */}
      {proofModalCamp && (
        <DisbursementProofModal
          camp={proofModalCamp}
          isOpen={Boolean(proofModalCamp)}
          onClose={() => setProofModalCamp(null)}
          theme={theme}
        />
      )}

    </div>
  );
}
