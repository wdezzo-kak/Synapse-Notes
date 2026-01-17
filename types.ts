
export interface NotionConfig {
  workerUrl: string;
  databaseId: string;
  notionToken: string;
  isEnabled: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  url: string;
  favIconUrl?: string;
  timestamp: number;
  color: string;
}

export interface ExtensionSettings {
  isHoverTriggerActive: boolean;
  theme: 'light' | 'dark';
  notionConfig?: NotionConfig;
}
