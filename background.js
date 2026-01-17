
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "SAVE_NOTE") {
    chrome.storage.local.get(['notes'], (result) => {
      const notes = result.notes || [];
      const newNote = {
        id: Date.now().toString(),
        title: message.title || 'Page Note',
        content: message.content,
        url: sender.tab?.url || '',
        favIconUrl: sender.tab?.favIconUrl || '',
        timestamp: Date.now(),
        color: '#ffffff'
      };
      chrome.storage.local.set({ notes: [newNote, ...notes] }, () => {
        sendResponse({ success: true });
      });
    });
    return true; // async response
  }
});
