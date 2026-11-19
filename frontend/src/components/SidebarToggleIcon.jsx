export default function SidebarToggleIcon({ className = '' }) {
  return (
    <svg 
      width="18" 
      height="18" 
      viewBox="0 0 20 20" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`ref-sidebar-toggle-icon ${className}`}
      aria-hidden="true"
    >
      {/* Outer rounded window container */}
      <rect x="2" y="3" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
      
      {/* Expanded state (Image 2): full vertical dividing line */}
      <line 
        className="ref-toggle-line-expanded" 
        x1="7" 
        y1="3" 
        x2="7" 
        y2="17" 
        stroke="currentColor" 
        strokeWidth="1.5" 
      />
      
      {/* Collapsed state (Image 1): internal left pill */}
      <line 
        className="ref-toggle-line-collapsed" 
        x1="5.5" 
        y1="6.5" 
        x2="5.5" 
        y2="13.5" 
        stroke="currentColor" 
        strokeWidth="1.8" 
        strokeLinecap="round" 
      />
    </svg>
  );
}
