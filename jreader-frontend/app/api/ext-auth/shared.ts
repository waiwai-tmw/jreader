// In-memory storage for testing (in production, use a database)
// Use a global variable to persist across module reloads
declare global {
  var __completedNonces: Map<string, any> | undefined;
}

// Ensure we always have a Map instance
if (!globalThis.__completedNonces) {
  globalThis.__completedNonces = new Map<string, any>();
}

export const completedNonces = globalThis.__completedNonces;

// Add a helper function to ensure it's a Map
export function ensureMap(): Map<string, any> {
  if (!(completedNonces instanceof Map)) {
    console.error("completedNonces is not a Map, recreating...");
    globalThis.__completedNonces = new Map<string, any>();
    return globalThis.__completedNonces;
  }
  return completedNonces;
}
