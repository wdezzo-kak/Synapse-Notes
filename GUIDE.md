# 🧠 Synapse Notes: Notion Integration Guide

This guide explains how to connect your **Synapse Notes** extension to **Notion** securely using a **Cloudflare Worker** as a private proxy.

## 🛡️ Security Architecture
To prevent leaking your **Notion API Token** and to bypass browser security (CORS) restrictions, we use a "Zero-Exposure" bridge:
1. **Extension**: Stores your credentials locally and encrypted.
2. **Cloudflare Worker**: Acts as your private, authenticated gatekeeper.
3. **Notion API**: Receives data only from your trusted Worker.

---

## 🚀 Phase 1: Setup Notion

### 1. Create a Notion Integration
1. Go to [Notion - My Integrations](https://www.notion.com/my-integrations).
2. Click **+ New integration**.
3. Name it `Synapse Proxy` and select your workspace.
4. **Copy the "Internal Integration Secret"**. You will need this later (this is your `notionToken`).

### 2. Prepare your Database
1. Create a new **Table** database in Notion.
2. You **must** define these 3 columns with exact names (case-sensitive):
   - `Title` (Type: **Title**)
   - `URL` (Type: **URL**)
   - `Date` (Type: **Date**)
3. **Add the Connection**:
   - On your Database page, click the `...` (top right).
   - Scroll to **Add connections**.
   - Search for and select **Synapse Proxy**.

### 3. Get your Database ID
1. Look at the URL of your Notion database.
2. The ID is the string of characters after the slash and before the `?v=`.
   - *Example:* `notion.so/myworkspace/7d8e9f...` -> ID is `7d8e9f...`

---

## ☁️ Phase 2: Setup Cloudflare Worker

1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Navigate to **Workers & Pages** > **Create application** > **Create Worker**.
3. Name it `synapse-notion-bridge`.
4. Click **Deploy**.
5. Click **Edit Code** and paste the following snippet:

```typescript
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") return new Response("Use POST", { status: 405 });

    try {
      const { note, notionToken, databaseId } = await request.json();

      const res = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${notionToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties: {
            Title: { title: [{ text: { content: note.title } }] },
            URL: { url: note.url },
            Date: { date: { start: new Date(note.timestamp).toISOString() } },
          },
          children: [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: { rich_text: [{ type: 'text', text: { content: note.content } }] },
            },
          ],
        }),
      });

      const result = await res.json();
      return new Response(JSON.stringify(result), {
        status: res.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  },
};
```

6. Click **Save and Deploy**.
7. **Copy your Worker URL** (e.g., `https://synapse-notion-bridge.user.workers.dev`).

---

## ⚙️ Phase 3: Configure the Extension

1. Open the **Synapse Notes** side panel.
2. Click the **Gear Icon** ⚙️ to open Settings.
3. Paste your:
   - **Worker URL**
   - **Notion Token** (`secret_...`)
   - **Database ID**
4. Click **Save Configuration**.

---

## ✅ Testing the Sync
1. Create a note in the extension.
2. Hover over the note and click the **Notion Icon** (N).
3. Check your Notion database. Your note should appear instantly!
