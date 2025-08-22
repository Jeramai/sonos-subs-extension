/**
 * Injects a script into the main page's context.
 * @param {string} filePath - The path to the script to inject.
 */
function injectScript(filePath) {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL(filePath);
  // The script will be removed from the DOM after it has been loaded.
  script.onload = () => {
    script.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

injectScript('patch.js');
