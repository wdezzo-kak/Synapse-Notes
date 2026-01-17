
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  const [isLoaded, setIsLoaded] = useState(false);
  const isInitialLoad = useRef(true);
  
  // UI states
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState({ title: '', content: '', color: DEFAULT_NOTE_COLOR });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false);
  const [syncingNoteId, setSyncingNoteId] = useState<string | null>(null);
  const [noteIdToDelete, setNoteIdToDelete] = useState<string | null>(null);

  // Initialize: Load notes and settings from Chrome Storage
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
          if (result.settings) {
            setSettings(prev => ({ ...prev, ...result.settings }));
          }
          // Mark as loaded ONLY after we've applied stored settings
          setIsLoaded(true);
          isInitialLoad.current = false;
        });

        // Listen for changes from other contexts (like the content script)
        const listener = (changes: any) => {
          if (changes.notes) setNotes(changes.notes.newValue);
          // If settings changed elsewhere, sync them locally without triggering a save loop
          if (changes.settings && isInitialLoad.current === false) {
            setSettings(prev => ({ ...prev, ...changes.settings.newValue }));
          }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
      } else {
        // Fallback for non-extension environment
        setIsLoaded(true);
      }
    };
    init();
  }, []);

  // Persist settings and notes whenever they change, but only after initial load
  useEffect(() => {
    if (!isLoaded) return;

    const chrome = (window as any).chrome;
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ notes, settings });
    }
  }, [notes, settings, isLoaded]);

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

  const handleDeleteNote = () => {
    if (noteIdToDelete) {
      setNotes(prev => prev.filter(n => n.id !== noteIdToDelete));
      setNoteIdToDelete(null);
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

  const toggleHoverTrigger = () => {
    setSettings(prev => ({
      ...prev,
      isHoverTriggerActive: !prev.isHoverTriggerActive
    }));
  };

  const notionReady = settings.notionConfig?.workerUrl && settings.notionConfig?.notionToken;

  if (!isLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900">
        <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }

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
        {filteredNotes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 text-center p-8">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
              <Icons.Clipboard />
            </div>
            <div>
              <p className="font-semibold text-gray-400">No synapses found</p>
              <p className="text-xs">Capture your first thought to begin.</p>
            </div>
          </div>
        )}
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
                    <button onClick={() => setNoteIdToDelete(note.id)} className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-slate-700"><Icons.Trash /></button>
                  </div>
                </div>
                <p className="text-sm text-gray-300 line-clamp-3 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                {note.url && <div className="mt-3 text-[10px] text-gray-500 flex items-center gap-1"><Icons.External /> {new URL(note.url).hostname}</div>}
              </div>
            )}
          </div>
        ))}
      </main>

      {/* Delete Confirmation Modal */}
      {noteIdToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl p-6 bg-slate-800 border border-slate-700 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-white mb-2">Delete Note?</h3>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              This action cannot be undone. Are you sure you want to remove this synapse?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setNoteIdToDelete(null)} 
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteNote} 
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-sm font-semibold text-white transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl p-6 bg-slate-800 border border-slate-700 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-slate-800 z-10 py-1">
              <h2 className="text-xl font-bold flex items-center gap-2"><Icons.Settings /> Configuration</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 text-gray-500 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            
            <div className="space-y-8">
              {/* General Section */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-bold text-orange-500 uppercase tracking-widest border-b border-slate-700 pb-2">Browser Features</h3>
                <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-700">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-white">Floating Hover Trigger</p>
                    <p className="text-[11px] text-gray-500">Show a quick-capture icon on every webpage.</p>
                  </div>
                  <button 
                    onClick={toggleHoverTrigger}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none ${settings.isHoverTriggerActive ? 'bg-orange-500' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.isHoverTriggerActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Database:</span>
                  <span className="text-[10px] text-gray-400 bg-slate-700 px-2 py-0.5 rounded">chrome.storage.local</span>
                </div>
              </section>

              {/* Notion Integration Section */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-bold text-orange-500 uppercase tracking-widest border-b border-slate-700 pb-2">Notion Integration</h3>
                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
                  <p className="text-[11px] text-orange-200 leading-relaxed">
                    Integration requires a <strong>Cloudflare Worker</strong> proxy to keep your Notion Token secret. 
                    See the <span onClick={() => {setIsSettingsOpen(false); setIsGuideOpen(true);}} className="underline cursor-pointer font-bold">Setup Guide</span> for details.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Cloudflare Worker URL</label>
                    <input 
                      type="text" placeholder="https://your-worker.workers.dev"
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-gray-600"
                      value={settings.notionConfig?.workerUrl || ''}
                      onChange={(e) => setSettings({...settings, notionConfig: {...(settings.notionConfig || {} as NotionConfig), workerUrl: e.target.value}})}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Notion Secret Token</label>
                    <input 
                      type="password" placeholder="secret_..."
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-gray-600"
                      value={settings.notionConfig?.notionToken || ''}
                      onChange={(e) => setSettings({...settings, notionConfig: {...(settings.notionConfig || {} as NotionConfig), notionToken: e.target.value}})}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Database ID</label>
                    <input 
                      type="text" placeholder="Paste your database ID"
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-gray-600"
                      value={settings.notionConfig?.databaseId || ''}
                      onChange={(e) => setSettings({...settings, notionConfig: {...(settings.notionConfig || {} as NotionConfig), databaseId: e.target.value}})}
                    />
                  </div>
                </div>
              </section>
            </div>

            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="w-full mt-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Integration Guide Modal */}
      {isGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl p-8 bg-slate-800 border border-slate-700 shadow-2xl overflow-y-auto max-h-[85vh]">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Icons.Info /> Setup Guide</h2>
            
            <div className="space-y-6 text-sm text-gray-300 leading-relaxed">
              <p>For a complete, secure setup, follow our <strong>Zero-Exposure</strong> guide on GitHub:</p>
              
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700 space-y-4">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-bold">1</div>
                  <div>
                    <h4 className="font-bold text-white mb-1">Notion Integration</h4>
                    <p className="text-xs text-gray-400">Create an internal integration in Notion to get your secret token.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold">2</div>
                  <div>
                    <h4 className="font-bold text-white mb-1">Cloudflare Worker</h4>
                    <p className="text-xs text-gray-400">Deploy the bridge script (check README) to handle secure handshakes.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-[10px] font-bold">3</div>
                  <div>
                    <h4 className="font-bold text-white mb-1">Database Mapping</h4>
                    <p className="text-xs text-gray-400">Ensure your table has "Title", "URL", and "Date" columns exactly.</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                <p className="text-xs text-purple-200">
                  Refer to the <code>GUIDE.md</code> file in your extension folder for the complete deployment script.
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
            <input className="w-full mb-3 p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-orange-500" placeholder="Title" value={editingData.title} onChange={(e) => setEditingData({...editingData, title: e.target.value})} />
            <textarea rows={6} className="w-full mb-6 p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-orange-500" placeholder="Write thoughts..." value={editingData.content} onChange={(e) => setEditingData({...editingData, content: e.target.value})} />
            <div className="flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-colors">Cancel</button>
              <button onClick={() => {
                setNotes(prev => [{ id: Date.now().toString(), title: editingData.title || 'Note', content: editingData.content, url: window.location.href, timestamp: Date.now(), color: DEFAULT_NOTE_COLOR }, ...prev]);
                setIsModalOpen(false);
              }} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold transition-colors">Save</button>
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
