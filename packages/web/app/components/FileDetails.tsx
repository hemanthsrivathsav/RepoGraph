'use client';

import React from 'react';

const TOP_OFFSET = 44; // height of your top bar in page.tsx

export default function FileDetails({
  path,
  onClose,
}: {
  path: string;
  onClose: () => void;
}) {
  const fileName = path.replace(/\\/g, '/').split('/').pop() || path;

  const describe = () => {
    if (typeof window !== 'undefined') {
      window.alert('Hook this to Copilot/LLM later');
    } else {
      console.log('Hook this to Copilot/LLM later');
    }
  };

  return (
    <>
      {/* Optional dim backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          top: TOP_OFFSET,
          background: 'rgba(0,0,0,0.25)',
          zIndex: 49,
        }}
      />

      {/* Floating details panel with rounded corners and edge gaps */}
      <aside
        style={{
          position: 'fixed',
          top: TOP_OFFSET + 16, // small top gap
          right: 16, // gap from right edge
          height: `calc(100vh - ${TOP_OFFSET + 32}px)`, // top + bottom gap
          width: 380,
          maxWidth: '90vw',
          background: '#0e1117',
          color: '#e5e7eb',
          border: '1px solid #232833',
          borderRadius: 12,
          display: 'grid',
          gridTemplateRows: '48px 1fr',
          zIndex: 50,
          boxShadow:
            '0 0 0 1px rgba(0,0,0,0.3), 0 10px 25px rgba(0,0,0,0.35)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderBottom: '1px solid #232833',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
          }}
        >
          <div style={{ opacity: 0.9, fontWeight: 600 }}>Details</div>
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: '#1f2937',
              color: '#e5e7eb',
              border: '1px solid #2b3140',
              padding: '6px 10px',
              borderRadius: 8,
              cursor: 'pointer',
              lineHeight: 1,
            }}
            aria-label="Close details"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 12, overflowY: 'auto' }}>
          <div style={{ fontSize: 16, marginBottom: 8 }}>
            <strong>{fileName}</strong>
          </div>
          <div
            style={{
              opacity: 0.8,
              marginBottom: 12,
              wordBreak: 'break-all',
            }}
          >
            {path}
          </div>

          <div
            style={{
              background: '#0f1119',
              border: '1px solid #232833',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <div style={{ marginBottom: 8, opacity: 0.9 }}>
              <em>AI summary (placeholder):</em>
            </div>
            <div style={{ opacity: 0.85 }}>
              Click “Describe file” to generate a summary of what this file
              does, key functions/exports, and where it’s used.
            </div>

            <button
              style={{
                marginTop: 12,
                background: '#1f2937',
                color: '#e5e7eb',
                border: '1px solid #2b3140',
                padding: '6px 10px',
                borderRadius: 8,
                cursor: 'pointer',
              }}
              onClick={describe}
            >
              Describe file
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
