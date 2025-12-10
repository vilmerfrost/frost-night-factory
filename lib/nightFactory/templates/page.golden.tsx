// lib/nightFactory/templates/page.golden.tsx
// Golden Standard Fail-Safe Page Template
// This is the bulletproof page that ALWAYS works

// ✅ Step 1: ALL imports first
import React from 'react';

// ✅ Step 2: Component (no route config needed for basic page)
export default function Page() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0A0A0A 0%, #1a1a2e 100%)',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '500px', width: '100%', textAlign: 'center' }}>
        {/* Profile Avatar */}
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%)',
          margin: '0 auto 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3rem',
          fontWeight: 'bold',
          boxShadow: '0 20px 60px rgba(139, 92, 246, 0.4)'
        }}>
          ✨
        </div>
        {/* Username */}
        <h1 style={{ 
          fontSize: '2rem', 
          marginBottom: '0.5rem',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Welcome
        </h1>
        
        {/* Bio */}
        <p style={{ 
          fontSize: '1rem', 
          opacity: 0.7,
          marginBottom: '2rem'
        }}>
          Your application is ready 🚀
        </p>
        
        {/* Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            { icon: '🎨', title: 'Dashboard', href: '/dashboard' },
            { icon: '📊', title: 'Analytics', href: '/dashboard/analytics' },
            { icon: '⚙️', title: 'Settings', href: '/dashboard/settings' },
          ].map((link, i) => (
            <a
              key={i}
              href={link.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1.25rem 1.5rem',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '1rem',
                textDecoration: 'none',
                color: '#ffffff',
                fontSize: '1.125rem',
                fontWeight: '600',
                transition: 'all 0.3s',
                cursor: 'pointer'
              }}
              onMouseOver={(e: React.MouseEvent<HTMLAnchorElement>) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                e.currentTarget.style.borderColor = '#8B5CF6';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={(e: React.MouseEvent<HTMLAnchorElement>) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>{link.icon}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{link.title}</span>
              <span style={{ opacity: 0.5 }}>→</span>
            </a>
          ))}
        </div>
        
        {/* Footer */}
        <p style={{ 
          marginTop: '3rem', 
          opacity: 0.4, 
          fontSize: '0.875rem' 
        }}>
          Powered by Frost Night Factory ✨
        </p>
      </div>
    </div>
  );
}

