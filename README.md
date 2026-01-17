# 🧠 Synapse Notes

**Synapse Notes** is a high-performance Chrome extension designed for high-intensity research and seamless workspace integration. It features a sleek side-panel interface, AI-powered summarization, and a secure "Zero-Exposure" Notion sync architecture.

![Brave Orange Theme](https://img.shields.io/badge/Theme-Brave%20Orange-f97316)
![React 19](https://img.shields.io/badge/React-19-61dafb)
![Tailwind CSS](https://img.shields.io/badge/CSS-Tailwind-38b2ac)
![Cloudflare Workers](https://img.shields.io/badge/Proxy-Cloudflare%20Workers-f38020)

---

## ✨ Key Features

- 📑 **Side Panel Integration**: Built specifically for the Chrome Side Panel API for a non-intrusive workflow.
- 🚀 **Floating Hover Trigger**: A quick-capture icon that follows you across the web (can be toggled in settings).
- 🤖 **AI Focus Summary**: Utilizes the **Gemini 3 Pro** model to analyze your recent notes and identify your current research focus.
- 🔐 **Secure Notion Sync**: Exports notes to Notion using a private Cloudflare Worker proxy to ensure your API tokens never leave your control.
- 📝 **Markdown Ready**: One-click "Copy for Notion/NotebookLM" to preserve formatting when moving data manually.
- 🎨 **Accent Customization**: Color-code your research with beautiful presets.

---

## 🛠️ Installation

1. **Download/Clone** this repository to your local machine.
2. Open Brave or Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top right toggle).
4. Click **Load unpacked** and select the root folder of this project.
5. Pin the extension for quick access or use the Side Panel button.

---

## 🔐 Secure Notion Integration (Zero-Exposure)

We prioritize your security. Unlike other extensions that might leak your Notion tokens, Synapse Notes uses a **Cloudflare Worker Proxy** architecture. 

### Why this is safer:
- Your Notion Token is stored in your browser's local storage.
- It is only sent to **your private** Cloudflare Worker.
- The Worker handles the Notion API handshake, bypassing browser CORS restrictions securely.

**[👉 Follow the step-by-step Setup Guide here (GUIDE.md)](GUIDE.md)**

---

## 🤖 AI Features Setup

Synapse Notes uses the Google Gemini API for its "Summarize Focus" feature.
1. Click the **Connect AI** button in the header.
2. You will be prompted to select your API key via the secure AI Studio interface.
3. Once connected, click **Summarize Focus** to get a high-level overview of your research context.

---

## 📁 Technical Architecture

- **Frontend**: React 19 (Functional Components + Hooks)
- **Styling**: Tailwind CSS
- **Storage**: `chrome.storage.local` for persistence
- **Content Scripts**: Injected floating trigger for quick-capture UI
- **Background Service Worker**: Handles message passing and note instantiation
- **Proxy**: Cloudflare Workers (TypeScript)

---

## 📄 License

MIT License - Feel free to fork and enhance!

---

*Built for researchers, by engineers. Keep your thoughts in sync.*