
import React, { useState, useEffect, useMemo } from 'react';
import { Note, ExtensionSettings, NotionConfig } from './types';
import { Icons, DEFAULT_NOTE_COLOR, PRESET_COLORS } from './constants';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [settings, setSettings] = useState<ExtensionSettings>({
    isHoverTriggerActive: false,
    theme: 'dark',
    notionConfig: {
      workerUrl: '',
      databaseId: '',
      notionToken: '',
      isEnabled: false
    }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isKeySelected, setIsKeySelected] = useState<boolean | null>(null);
  
  // UI states
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState({ title: '', content: '', color: DEFAULT_NOTE_COLOR });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false);
  const [syncingNoteId, setSyncingNoteId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setIsKeySelected(hasKey);
      } catch (e) {
        setIsKeySelected(false);
      }

      const chrome = (window as any).chrome;
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['notes', 'settings'], (result: any) => {
          if (result.notes) setNotes(result.notes);
          if (result.settings) setSettings(prev => ({ ...prev, ...result.settings }));
        });
      }
    };
    init();
  }, []);

  useEffect(() => {
    const chrome = (window as any).chrome;
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ notes, settings });
    }
  }, [notes, settings]);

  const handleConnectKey = async () => {
    try {
      await (window as any).aistudio.openSelectKey();
      setIsKeySelected(true);
      return true;
    } catch (e) {
      return false;
    }
  };

  const openAddModal = () => {
    setEditingNoteId(null);
    setEditingData({ title: '', content: '', color: DEFAULT_NOTE_COLOR });
    setIsModalOpen(true);
  };

  const startInlineEdit = (note: Note) => {
    setEditingNoteId(note.id);
    setEditingData({ title: note.title, content: note.content, color: note.color });
  };

  const saveInlineEdit = () => {
    if (editingNoteId) {
      setNotes(prev => prev.map(n => n.id === editingNoteId ? {
        ...n,
        title: editingData.title || 'Untitled Note',
        content: editingData.content,
        color: editingData.color,
        timestamp: Date.now()
      } : n));
      setEditingNoteId(null);
    }
  };

  const syncToNotion = async (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const config = settings.notionConfig;
    if (!config || !config.workerUrl || !config.notionToken || !config.databaseId) {
      alert("Please configure Notion integration in settings first.");
      setIsSettingsOpen(true);
      return;
    }

    setSyncingNoteId(note.id);
    try {
      const response = await fetch(config.workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note,
          notionToken: config.notionToken,
          databaseId: config.databaseId
        })
      });

      if (response.ok) {
        alert("Synced to Notion successfully!");
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to sync");
      }
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncingNoteId(null);
    }
  };

  const handleSmartSummarize = async () => {
    if (!isKeySelected) {
      const success = await handleConnectKey();
      if (!success) return;
    }

    setIsLoadingGlobal(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = notes.slice(0, 5).map(n => n.content).join('\n---\n');
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Briefly summarize recent focus: ${context}`,
        config: { maxOutputTokens: 200 }
      });

      const summary = response.text || "Couldn't generate summary.";
      const newNote: Note = {
        id: Date.now().toString(),
        title: "AI Brain Summary",
        content: summary,
        url: window.location.href,
        timestamp: Date.now(),
        color: '#a855f7'
      };
      setNotes(prev => [newNote, ...prev]);
    } catch (err) {
      alert("Summarization failed.");
    } finally {
      setIsLoadingGlobal(false);
    }
  };

  const filteredNotes = useMemo(() => {
    return notes.filter(n => 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [notes, searchQuery]);

  const notionReady = settings.notionConfig?.workerUrl && settings.notionConfig?.notionToken;

  return (
    <div className="flex flex-col h-screen max-h-screen bg-slate-900 text-gray-100 font-sans">
      <header className="p-4 border-b border-slate-700 shadow-sm flex items-center justify-between sticky top-0 z-10 bg-slate-800">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 61 61" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
            <path d="M30 0C13.431 0 0 13.431 0 30s13.431 30 30 30 30-13.431 30-30S46.569 0 30 0z" fill="#f97316"/>
            <path d="M20 20h20v20H20z" fill="#fff" fillOpacity=".2"/>
          </svg>
          <h1 className="text-lg font-bold text-white tracking-tight">Synapse</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-gray-400 hover:text-white transition-colors relative">
            <Icons.Settings />
            {!notionReady && <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full"></span>}
          </button>
          <button onClick={() => setIsGuideOpen(true)} className="p-2 text-gray-400 hover:text-white transition-colors">
            <Icons.Info />
          </button>
          <button onClick={openAddModal} className="p-2 bg-orange-500 hover:bg-orange-600 rounded-full text-white ml-1">
            <Icons.Plus />
          </button>
        </div>
      </header>

      <div className="p-4 space-y-3 border-b border-slate-700 bg-slate-900">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><Icons.Search /></span>
          <input 
            type="text" placeholder="Search nodes..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-700 rounded-xl bg-slate-800 text-white text-sm outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={handleSmartSummarize} disabled={isLoadingGlobal || notes.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all">
            {isLoadingGlobal ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Icons.Sparkles />}
            Summarize Focus
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900">
        {filteredNotes.map((note) => (
          <div key={note.id} className="group relative border border-slate-700 rounded-2xl bg-slate-800 overflow-hidden" style={{ borderLeft: `6px solid ${note.color}` }}>
            {editingNoteId === note.id ? (
              <div className="p-4 space-y-3">
                <input className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={editingData.title} onChange={(e) => setEditingData({...editingData, title: e.target.value})} />
                <textarea className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm h-32" value={editingData.content} onChange={(e) => setEditingData({...editingData, content: e.target.value})} />
                <div className="flex gap-2">
                  <button onClick={saveInlineEdit} className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-xs font-bold">Save</button>
                  <button onClick={() => setEditingNoteId(null)} className="flex-1 py-2 bg-slate-700 rounded-lg text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-white cursor-pointer" onClick={() => startInlineEdit(note)}>{note.title}</h3>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => syncToNotion(note, e)} disabled={syncingNoteId === note.id} 
                      className="p-2 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-slate-700 transition-colors" title="Sync to Notion">
                      {syncingNoteId === note.id ? <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div> : <Icons.Notion />}
                    </button>
                    <button onClick={() => setNotes(prev => prev.filter(n => n.id !== note.id))} className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-slate-700"><Icons.Trash /></button>
                  </div>
                </div>
                <p className="text-sm text-gray-300 line-clamp-3 whitespace-pre-wrap">{note.content}</p>
                {note.url && <div className="mt-3 text-[10px] text-gray-500 flex items-center gap-1"><Icons.External /> {new URL(note.url).hostname}</div>}
              </div>
            )}
          </div>
        ))}
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl p-6 bg-slate-800 border border-slate-700 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2"><Icons.Settings /> Integration Setup</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-500 hover:text-white">&times;</button>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl mb-4">
                <p className="text-xs text-orange-200 leading-relaxed font-medium">
                  To sync with Notion securely, you need a <strong>Cloudflare Worker</strong> proxy. 
                  This prevents leaking your API keys and bypasses browser security restrictions.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Cloudflare Worker URL</label>
                <input 
                  type="text" placeholder="https://your-worker.workers.dev"
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-orange-500"
                  value={settings.notionConfig?.workerUrl || ''}
                  onChange={(e) => setSettings({...settings, notionConfig: {...(settings.notionConfig || {} as NotionConfig), workerUrl: e.target.value}})}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Notion Integration Token</label>
                <input 
                  type="password" placeholder="secret_..."
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-orange-500"
                  value={settings.notionConfig?.notionToken || ''}
                  onChange={(e) => setSettings({...settings, notionConfig: {...(settings.notionConfig || {} as NotionConfig), notionToken: e.target.value}})}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Database ID</label>
                <input 
                  type="text" placeholder="Paste your database ID"
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-orange-500"
                  value={settings.notionConfig?.databaseId || ''}
                  onChange={(e) => setSettings({...settings, notionConfig: {...(settings.notionConfig || {} as NotionConfig), databaseId: e.target.value}})}
                />
              </div>
            </div>

            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="w-full mt-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-95"
            >
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* Integration Guide Modal */}
      {isGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl p-8 bg-slate-800 border border-slate-700 shadow-2xl overflow-y-auto max-h-[85vh]">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Icons.Info /> Setup Guide</h2>
            
            <div className="space-y-6 text-sm text-gray-300">
              <p>For a complete, secure setup, follow our <strong>Zero-Exposure</strong> guide on GitHub:</p>
              
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700 space-y-4">
                <div>
                  <h4 className="font-bold text-orange-400 mb-1">1. Notion Integration</h4>
                  <p className="text-xs text-gray-400">Create an internal integration in Notion to get your token.</p>
                </div>
                <div>
                  <h4 className="font-bold text-blue-400 mb-1">2. Cloudflare Worker</h4>
                  <p className="text-xs text-gray-400">Deploy a small proxy script to keep your tokens secret.</p>
                </div>
                <div>
                  <h4 className="font-bold text-purple-400 mb-1">3. Sync!</h4>
                  <p className="text-xs text-gray-400">Paste your credentials into Settings and start syncing notes.</p>
                </div>
              </div>

              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                <p className="text-xs text-purple-200">
                  Refer to <code>GUIDE.md</code> in the project root for the Cloudflare script and detailed Notion database column mapping.
                </p>
              </div>
            </div>

            <button 
              onClick={() => setIsGuideOpen(false)}
              className="w-full mt-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-2xl transition-all"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}

      {/* Quick Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl p-6 bg-slate-800 border border-slate-700 shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Capture Note</h2>
            <input className="w-full mb-3 p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none" placeholder="Title" value={editingData.title} onChange={(e) => setEditingData({...editingData, title: e.target.value})} />
            <textarea rows={6} className="w-full mb-6 p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm" placeholder="Write thoughts..." value={editingData.content} onChange={(e) => setEditingData({...editingData, content: e.target.value})} />
            <div className="flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-slate-700 rounded-xl font-bold">Cancel</button>
              <button onClick={() => {
                setNotes(prev => [{ id: Date.now().toString(), title: editingData.title || 'Note', content: editingData.content, url: window.location.href, timestamp: Date.now(), color: DEFAULT_NOTE_COLOR }, ...prev]);
                setIsModalOpen(false);
              }} className="flex-1 py-3 bg-orange-500 rounded-xl font-bold">Save</button>
            </div>
          </div>
        </div>
      )}

      <footer className="p-3 border-t border-slate-800 text-center bg-slate-900 text-[10px] font-bold text-gray-600 uppercase tracking-widest">
        Synapse Notes v1.2
      </footer>
    </div>
  );
};

export default App;
