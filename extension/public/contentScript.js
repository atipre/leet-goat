// Content script for DSA Problem Solver

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'captureVisible') {
    try {
      // Just notify that we're ready - the popup will handle the capture
      sendResponse({ success: true, message: 'Content script ready' });
    } catch (error) {
      sendResponse({ success: false, error: error.toString() });
    }
  }
  
  // Return true to indicate we'll respond asynchronously
  return true;
});

// Backup method using html2canvas if available
function tryHtml2Canvas() {
  // Load html2canvas if it's not already loaded
  if (!window.html2canvas) {
    const script = document.createElement('script');
    script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
    script.onload = () => {
      // html2canvas loaded successfully
    };
    script.onerror = () => {
      // Failed to load html2canvas
    };
    document.head.appendChild(script);
  }
} 