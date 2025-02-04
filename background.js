// Listen for connections from popup and content script
let popupPort = null;
let contentPort = null;

// Handle connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    popupPort = port;
    port.onDisconnect.addListener(() => {
      popupPort = null;
    });
  } else if (port.name === 'content') {
    contentPort = port;
    port.onDisconnect.addListener(() => {
      contentPort = null;
    });
  }
});

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Forward messages between popup and content script
  if (message.action === 'scan') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message);
      }
    });
  } else if (message.action === 'scanProgress' || message.action === 'scanComplete' || message.action === 'scanError') {
    // Forward these messages to the popup if it's open
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore errors when popup is closed
    });
  }
  
  return true; // Keep the message channel open for async responses
});

// Handle installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Broken Link & Image Scanner installed');
}); 