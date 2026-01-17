
(function() {
  // Check if we should show the hover trigger
  chrome.storage.local.get(['settings'], (result) => {
    if (result.settings?.isHoverTriggerActive) {
      initHoverIcon();
    }
  });

  // Listen for settings changes to show/hide icon dynamically
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      const active = changes.settings.newValue?.isHoverTriggerActive;
      const existing = document.getElementById('synapse-notes-hover-trigger');
      if (active && !existing) {
        initHoverIcon();
      } else if (!active && existing) {
        existing.remove();
      }
    }
  });

  function initHoverIcon() {
    if (document.getElementById('synapse-notes-hover-trigger')) return;

    const btn = document.createElement('div');
    btn.id = 'synapse-notes-hover-trigger';
    
    // Using runtime.getURL to safely access the extension icon from the content script
    const iconUrl = chrome.runtime.getURL('icon.png');
    
    btn.innerHTML = `
      <div style="width:48px; height:48px; background:#f97316; border-radius:12px; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.4); transition:transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); overflow:hidden;">
        <img src="${iconUrl}" style="width:100%; height:100%; object-fit:cover;" alt="Synapse Notes" />
      </div>
    `;
    
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: '2147483647',
      userSelect: 'none'
    });

    btn.addEventListener('mouseenter', () => {
      btn.firstElementChild.style.transform = 'scale(1.1)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.firstElementChild.style.transform = 'scale(1)';
    });

    btn.addEventListener('click', () => {
      openQuickNote();
    });

    document.body.appendChild(btn);
  }

  function openQuickNote() {
    if (document.getElementById('synapse-notes-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'synapse-notes-modal';
    Object.assign(modal.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '2147483647'
    });

    modal.innerHTML = `
      <div style="background:#1e293b; padding:28px; border-radius:24px; width:100%; max-width:420px; box-shadow:0 24px 48px rgba(0,0,0,0.5); font-family: 'Inter', sans-serif; border: 1px solid #334155;">
        <h3 style="margin:0 0 20px 0; font-size:20px; color:#f8fafc; font-weight: 700;">Quick Note</h3>
        <textarea id="synapse-quick-note-content" placeholder="Capture your thoughts..." style="width:100%; height:160px; padding:16px; border:1px solid #334155; border-radius:16px; margin-bottom:24px; font-size:15px; outline:none; font-family: inherit; resize:none; background: #334155; color: #f8fafc;"></textarea>
        <div style="display:flex; gap:12px;">
          <button id="synapse-quick-note-cancel" style="flex:1; padding:14px; border:none; border-radius:14px; background:#334155; color: #cbd5e1; cursor:pointer; font-weight:600; transition: background 0.2s;">Cancel</button>
          <button id="synapse-quick-note-save" style="flex:2; padding:14px; border:none; border-radius:14px; background:#f97316; color:white; cursor:pointer; font-weight:600; transition: background 0.2s;">Save Note</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const textarea = document.getElementById('synapse-quick-note-content');
    textarea.focus();

    document.getElementById('synapse-quick-note-cancel').addEventListener('click', () => modal.remove());
    document.getElementById('synapse-quick-note-save').addEventListener('click', () => {
      const content = textarea.value;
      if (content.trim()) {
        chrome.runtime.sendMessage({
          action: "SAVE_NOTE",
          content: content,
          title: "Quick Note"
        }, () => {
          modal.remove();
        });
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }
})();
