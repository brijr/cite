async function citeTab(tab) {
  if (!tab?.id) {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  }
  if (!tab?.id || !/^https?:/.test(tab.url || "")) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      files: ["cite.js"],
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: () => {
        if (window.__cite && typeof window.__cite.inspect === "function") {
          window.__cite.inspect();
        }
      },
    });
  } catch (_) {
    /* chrome://, Web Store, PDFs, and other restricted pages */
  }
}

chrome.action.onClicked.addListener(citeTab);
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "inspect") citeTab(tab);
});
