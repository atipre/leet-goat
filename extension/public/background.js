// Background script for LeetGoat extension
chrome.action.onClicked.addListener(async (tab) => {
  // Open the side panel when the extension icon is clicked
  await chrome.sidePanel.open({ tabId: tab.id });
});

// Set up side panel on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
