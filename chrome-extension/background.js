// Background Service Worker for Manifest V3

function isLinkedInHost(hostname) {
  return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
}

function isLinkedInJobsUrl(url) {
  if (typeof url !== "string" || !url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      isLinkedInHost(parsed.hostname) &&
      (parsed.pathname === "/jobs" || parsed.pathname.startsWith("/jobs/"))
    );
  } catch {
    return false;
  }
}

function isAnyLinkedInUrl(url) {
  if (typeof url !== "string" || !url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && isLinkedInHost(parsed.hostname);
  } catch {
    return false;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Career Compass Chrome Extension installed successfully.");
});

// Handle LinkedIn SPA navigations (pushState / popstate) and full page loads
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const url = changeInfo.url || (changeInfo.status === "complete" ? tab?.url : "");
  if (!isAnyLinkedInUrl(url)) return;

  if (isLinkedInJobsUrl(url)) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "LINKEDIN_URL_CHANGED", url });
      return;
    } catch {
      // Content script not yet injected (e.g., SPA navigation from /feed/ to /jobs/)
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
      await chrome.tabs.sendMessage(tabId, { type: "LINKEDIN_URL_CHANGED", url });
    } catch {
      // Tab may have closed or navigated away before injection completed
    }
  } else if (changeInfo.url) {
    // Navigated away from /jobs/* on LinkedIn SPA; notify content script to clean up UI
    try {
      await chrome.tabs.sendMessage(tabId, { type: "LINKEDIN_URL_CHANGED", url });
    } catch {
      // Content script not injected on this tab; ignore
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender?.id !== chrome.runtime.id) return false;
  if (!request || typeof request !== "object") return false;

  if (request.type === "OPEN_POPUP_OR_HINT") {
    if (typeof chrome.action?.openPopup === "function") {
      chrome.action
        .openPopup()
        .then(() => sendResponse({ opened: true }))
        .catch(() => sendResponse({ opened: false }));
      return true;
    }
    sendResponse({ opened: false });
    return false;
  }

  return false;
});
