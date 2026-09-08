import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext';
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

export default function NotificationCenter({ dbUser, theme, onSelectNotificationAction }) {
  if (!dbUser) return null;

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
  const [activeMenuId, setActiveMenuId] = useState(null); // 3-dots menu per item
  const [currentTime, setCurrentTime] = useState(Date.now()); // Real-time timestamp ticker
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const panelRef = useRef(null);

  // Dynamic category filter chips strictly role-specific (Inbox only)
  const getFilterChips = () => {
    const role = (dbUser?.role || 'donor').toLowerCase();
    if (role === 'donor') {
      return [
        { id: 'all', label: 'All' },
        { id: 'unread', label: 'Unread', count: unreadCount },
        { id: 'DONATION', label: 'Donations' },
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
        { id: 'VERIFICATION', label: 'SEC Audits' },
        { id: 'SECURITY', label: 'Security' }
      ];
    }
    // Admin
    return [
      { id: 'all', label: 'All' },
      { id: 'unread', label: 'Unread', count: unreadCount },
      { id: 'VERIFICATION', label: 'SEC Audits' },
      { id: 'SECURITY', label: 'Security' },
      { id: 'SYSTEM', label: 'System' }
    ];
  };

  // Live real-time polling with pagination & category support
  const fetchNotifications = async (pageNum = 1, append = false, currentFilter = filter) => {
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
        setHasMore(Boolean(data.hasMore));
        setPage(pageNum);

        if (append) {
          setNotifications(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const fresh = notifList.filter(n => !existingIds.has(n.id));
            return [...prev, ...fresh];
          });
        } else {
          setNotifications(notifList);
        }
      }
    } catch (err) {
      console.warn('Live notification sync fallback:', err);
    }
  };

  // Initial & periodic 3s live polling
  useEffect(() => {
    fetchNotifications(1, false, filter);
    const pollInterval = setInterval(() => {
      fetchNotifications(1, false, filter);
    }, 3000);
    return () => clearInterval(pollInterval);
  }, [dbUser, filter]);

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

    showInfo(newStatus ? 'Notification marked as read.' : 'Notification marked as unread.', 'Status Updated');

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
  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    await fetchNotifications(page + 1, true, filter);
    setIsLoadingMore(false);
  };

  // Icon mapping
  const getTypeIcon = (type) => {
    const t = (type || '').toUpperCase();
    switch (t) {
      case 'DONATION': return 'volunteer_activism';
      case 'CAMPAIGN': return 'campaign';
      case 'VERIFICATION':
      case 'KYC': return 'verified_user';
      case 'SECURITY': return 'shield_lock';
      case 'ACCOUNT': return 'person_check';
      case 'WITHDRAWAL': return 'payments';
      default: return 'notifications';
    }
  };

  // Color mapping
  const getTypeColor = (type) => {
    const t = (type || '').toUpperCase();
    switch (t) {
      case 'DONATION': return '#22c55e';
      case 'CAMPAIGN': return '#f59e0b';
      case 'VERIFICATION':
      case 'KYC': return '#38bdf8';
      case 'SECURITY': return '#a855f7';
      case 'ACCOUNT': return '#ec4899';
      case 'WITHDRAWAL': return '#10b981';
      default: return 'var(--accent, #22c55e)';
    }
  };

  // User-friendly label
  const getTypeLabel = (type) => {
    const t = (type || '').toUpperCase();
    switch (t) {
      case 'DONATION': return 'Donation Activity';
      case 'CAMPAIGN': return 'Disaster Relief Campaign';
      case 'VERIFICATION':
      case 'KYC': return 'SEC Accreditation & Governance';
      case 'SECURITY': return 'Protocol Security Alert';
      case 'ACCOUNT': return 'Account Lifecycle';
      case 'WITHDRAWAL': return 'Relief Disbursement';
      default: return 'System Notice';
    }
  };

  // Dynamic Relative Time Formatter (authoritative database timestamp vs live clock)
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Just now';
    const timestamp = new Date(dateStr).getTime();
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

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="bbdrts-notif-panel" data-theme={theme}>
          {/* Panel Header */}
          <div className="bbdrts-notif-header">
            <div className="bbdrts-notif-header-title">
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent, #22c55e)' }}>
                {filter === 'trash' ? 'auto_delete' : 'notifications_active'}
              </span>
              <strong>{filter === 'trash' ? 'Trash Bin' : 'Notifications'}</strong>
              {filter !== 'trash' && unreadCount > 0 && (
                <span className="bbdrts-notif-unread-pill">{unreadCount} New</span>
              )}
            </div>

            {/* Header Right Action Group */}
            <div className="bbdrts-notif-header-actions">
              {filter !== 'trash' && unreadCount > 0 && (
                <button
                  type="button"
                  className="bbdrts-notif-mark-btn"
                  onClick={handleMarkAllAsRead}
                  title="Mark all notifications as read"
                >
                  Mark all read
                </button>
              )}

              {/* Dedicated Trash / Inbox Toggle Button in Header */}
              <button
                type="button"
                className={`bbdrts-notif-trash-toggle-btn ${filter === 'trash' ? 'active' : ''}`}
                onClick={() => {
                  setFilter(prev => prev === 'trash' ? 'all' : 'trash');
                  setActiveMenuId(null);
                }}
                title={filter === 'trash' ? "Return to Notifications Inbox" : "Open 30-Day Trash Bin"}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  {filter === 'trash' ? 'inbox' : 'delete'}
                </span>
                <span>{filter === 'trash' ? 'Inbox' : 'Trash'}</span>
                {filter !== 'trash' && trashCount > 0 && (
                  <span className="bbdrts-trash-count-badge">{trashCount}</span>
                )}
              </button>
            </div>
          </div>

          {/* Dedicated View Navigation: Trash Bar vs Category Filter Chips */}
          {filter === 'trash' ? (
            <div className="bbdrts-notif-trash-nav-bar">
              <button
                type="button"
                className="bbdrts-notif-back-inbox-btn"
                onClick={() => {
                  setFilter('all');
                  setActiveMenuId(null);
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>arrow_back</span>
                <span>Back to Inbox</span>
              </button>

              <span className="bbdrts-notif-trash-info-text">
                {trashCount} {trashCount === 1 ? 'item' : 'items'} in Trash (30d auto-purge)
              </span>

              {trashCount > 0 && (
                <button
                  type="button"
                  className="bbdrts-notif-empty-trash-btn"
                  onClick={handleEmptyTrash}
                >
                  Empty Trash
                </button>
              )}
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
                  {chip.label} {chip.count !== undefined && chip.count > 0 ? `(${chip.count})` : ''}
                </button>
              ))}
            </div>
          )}

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
                            ● {getTypeLabel(n.type)}
                          </span>
                          {n.referenceId && (
                            <span className="bbdrts-notif-ref-tag">
                              Ref: {String(n.referenceId).substring(0, 16)}
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

      {/* ── Standard Consistent Notification Detail Card Modal ── */}
      {selectedNotif && (
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
                  <span className="bbdrts-notif-card-trash-timer-pill">
                    ⏰ {selectedNotif.daysRemaining !== undefined ? `${selectedNotif.daysRemaining} days left` : '30 days left'}
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
                  <span className="bbdrts-notif-card-meta-item ref">
                    <span className="material-symbols-outlined">tag</span>
                    Ref: {selectedNotif.referenceId}
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

                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        const target = selectedNotif;
                        setSelectedNotif(null);
                        if (onSelectNotificationAction) {
                          onSelectNotificationAction(target);
                        }
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        {selectedNotif.type === 'VERIFICATION' || selectedNotif.type === 'KYC' ? 'corporate_fare' : selectedNotif.type === 'SECURITY' ? 'settings' : 'explore'}
                      </span>
                      {selectedNotif.type === 'VERIFICATION' || selectedNotif.type === 'KYC' ? 'View Organization' : selectedNotif.type === 'SECURITY' ? 'Security Settings' : 'View On-Chain Ledger'}
                    </button>
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
        </div>
      )}

    </div>
  );
}
