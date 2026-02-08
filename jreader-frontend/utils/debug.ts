// In-memory buffer for debug messages
let messageBuffer: Array<{ timestamp: string; message: string }> = [];
const MAX_BUFFER_SIZE = 1000;

export function debug(message: string, data?: any) {
  const fullMessage = data ? `${message} ${JSON.stringify(data)}` : message;
  
  // Log to console
  console.debug(fullMessage);
  
  // Add to in-memory buffer
  messageBuffer.unshift({
    timestamp: new Date().toISOString(),
    message: fullMessage
  });

  // Keep buffer size under control
  if (messageBuffer.length > MAX_BUFFER_SIZE) {
    messageBuffer = messageBuffer.slice(0, MAX_BUFFER_SIZE);
  }
  
  // Dispatch event for DebugPane if it's mounted
  const event = new CustomEvent('debug', {
    detail: { message: fullMessage }
  });
  
  window.dispatchEvent(event);
}

// Function to get buffered messages
export function getDebugBuffer() {
  return messageBuffer;
}

// Function to clear buffer
export function clearDebugBuffer() {
  messageBuffer = [];
} 