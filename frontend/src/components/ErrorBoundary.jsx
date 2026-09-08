import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('BBDRTS ErrorBoundary intercepted error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.removeItem('bbdrts_token');
    } catch (_) {}
    window.location.href = '/#top';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          textAlign: 'center',
          color: '#f8fafc'
        }}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '540px',
            width: '100%',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ef4444', marginBottom: '16px' }}>
              warning
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 10px 0' }}>
              Interface Interruption Recovered
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              BBDRTS encountered an unexpected UI render condition. Your funds and cryptographic state remain safe and unaltered on Sepolia EVM.
            </p>

            {this.state.error && (
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontFamily: 'monospace',
                color: '#fca5a5',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '20px'
              }}>
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={this.handleReload}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
                Reload Page
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={this.handleReset}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>home</span>
                Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
