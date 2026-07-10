export interface CloudProgress {
  unlockedLevels: number;
}

export interface AppState {
  syncCode: string;
  progress: CloudProgress;
}

export interface GameData {
  id: string;
  title: string;
  type: string;
  bg: string;
  source?: string;
  url?: string;
}

export const API = {
  async saveProgress(syncCode: string, progress: CloudProgress) {
    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncCode, progress })
      });
    } catch (e) {
      console.error('Failed to save to cloud', e);
    }
  },

  async loadProgress(syncCode: string): Promise<CloudProgress | null> {
    try {
      const res = await fetch(`/api/load/${syncCode}`);
      const data = await res.json();
      return data.progress || null;
    } catch (e) {
      console.error('Failed to load from cloud', e);
      return null;
    }
  },

  async getGames(): Promise<GameData[]> {
    try {
      const res = await fetch('/api/games');
      return await res.json();
    } catch {
      return [];
    }
  },

  async installGame(game: Partial<GameData>) {
    try {
      await fetch('/api/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(game)
      });
    } catch (e) {
      console.error('Failed to install game', e);
    }
  },

  async uploadGame(file: File, title: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    try {
      const res = await fetch('/api/upload-game', {
        method: 'POST',
        body: formData
      });
      return await res.json();
    } catch (e) {
      console.error('Upload failed', e);
      return { error: 'Upload failed' };
    }
  }
};
