document.addEventListener('DOMContentLoaded', async () => {
  // Load saved results
  const data = await chrome.storage.local.get('currentResults');
  if (data.currentResults) {
    displayResults(data.currentResults);
  }

  // Handle close button
  document.getElementById('closeWindow').addEventListener('click', () => {
    chrome.storage.local.remove(['resultsWindowId', 'currentResults'], () => {
      window.close();
    });
  });
});

// Listen for result updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateResults') {
    displayResults(message.results);
  }
});

function displayResults(results) {
  const summary = document.getElementById('summary');
  const brokenLinks = document.getElementById('brokenLinks');
  const brokenImages = document.getElementById('brokenImages');

  summary.innerHTML = `
    <p>Total Links: ${results.totalLinks}</p>
    <p>Broken Links: ${results.brokenLinks.length}</p>
    <p>Total Images: ${results.totalImages}</p>
    <p>Broken Images: ${results.brokenImages.length}</p>
  `;

  if (results.brokenLinks.length === 0 && results.brokenImages.length === 0) {
    brokenLinks.innerHTML = '<p style="color: green">No broken links or images found!</p>';
    return;
  }

  brokenLinks.innerHTML = results.brokenLinks.length ? '<h3>Broken Links:</h3>' + 
    results.brokenLinks.map(link => `
      <div class="error-item">
        <div><strong>URL:</strong> ${link.url}</div>
        <div><strong>Text:</strong> ${link.text || 'No text'}</div>
        <div><strong>Status:</strong> ${link.statusCode || link.error}</div>
      </div>
    `).join('') : '';

  brokenImages.innerHTML = results.brokenImages.length ? '<h3>Broken Images:</h3>' + 
    results.brokenImages.map(image => `
      <div class="error-item">
        <div><strong>URL:</strong> ${image.url}</div>
        <div><strong>Alt:</strong> ${image.alt || 'No alt text'}</div>
        <div><strong>Status:</strong> ${image.statusCode || image.error}</div>
      </div>
    `).join('') : '';
} 