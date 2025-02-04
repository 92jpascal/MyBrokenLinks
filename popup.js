// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI elements
  const scanButton = document.getElementById('scanButton');
  const loadingElement = document.getElementById('loading');
  const resultsElement = document.getElementById('results');
  const progressElement = document.getElementById('progress');

  // Establish connection with background script
  const port = chrome.runtime.connect({ name: 'popup' });

  // Add click handler to scan button
  if (scanButton) {
    scanButton.addEventListener('click', async () => {
      if (!loadingElement || !resultsElement || !progressElement) {
        console.error('Required DOM elements not found');
        alert('Error: Extension UI not properly initialized. Please try reloading.');
        return;
      }

      // Show loading state
      loadingElement.style.display = 'block';
      resultsElement.style.display = 'none';

      // Initialize progress display
      loadingElement.innerHTML = `
        <div class="progress-wheel"></div>
        <div class="progress-text">Scanning page...</div>
        <div id="progress" class="progress-text">
          Links: 0/0<br>Images: 0/0
        </div>
      `;

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          // First, inject the content script
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['contentScript.js']
          });

          // Then send the scan message
          chrome.tabs.sendMessage(tab.id, { action: 'scan' }).catch(error => {
            loadingElement.innerHTML = `
              <div style="color: red; margin-top: 10px;">
                Error: Could not connect to page. Please refresh the page and try again.
              </div>
            `;
            console.error('Scan error:', error);
          });
        }
      } catch (error) {
        loadingElement.innerHTML = `
          <div style="color: red; margin-top: 10px;">
            Error: ${error.message}
          </div>
        `;
        console.error('Setup error:', error);
      }
    });
  } else {
    console.error('Scan button not found');
  }

  // Handle messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Re-query elements to ensure they exist
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const progress = document.getElementById('progress');

    if (!loading || !results) {
      console.error('Required DOM elements not found during message handling');
      return;
    }

    switch (message.action) {
      case 'scanComplete':
        displayResults(message.results);
        break;
      
      case 'scanProgress':
        if (loading && progress) {
          const linksPercent = Math.round((message.progress.links / message.progress.totalLinks) * 100) || 0;
          const imagesPercent = Math.round((message.progress.images / message.progress.totalImages) * 100) || 0;
          
          progress.innerHTML = `
            Links: ${message.progress.links}/${message.progress.totalLinks} (${linksPercent}%)<br>
            Images: ${message.progress.images}/${message.progress.totalImages} (${imagesPercent}%)
          `;
        }
        break;
      
      case 'scanError':
        if (loading) {
          loading.innerHTML = `
            <div style="color: red; margin-top: 10px;">
              Error scanning page: ${message.error}
            </div>
          `;
        }
        break;
    }
  });
});

function displayResults(results) {
  const loading = document.getElementById('loading');
  const resultsDiv = document.getElementById('results');
  const summary = document.getElementById('summary');
  const brokenLinks = document.getElementById('brokenLinks');
  const brokenImages = document.getElementById('brokenImages');

  if (!loading || !resultsDiv || !summary || !brokenLinks || !brokenImages) {
    console.error('Required DOM elements not found in displayResults');
    return;
  }

  loading.style.display = 'none';
  resultsDiv.style.display = 'block';

  summary.innerHTML = `
    <p>Total Links: ${results.totalLinks}</p>
    <p>Broken Links: ${results.brokenLinks.length}</p>
    <p>Total Images: ${results.totalImages}</p>
    <p>Broken Images: ${results.brokenImages.length}</p>
  `;

  if (results.brokenLinks.length === 0 && results.brokenImages.length === 0) {
    resultsDiv.innerHTML = `
      <div class="summary">
        <h3>Scan Results</h3>
        <div id="summary">
          <p style="color: green">No broken links or images found!</p>
        </div>
      </div>
    `;
    return;
  }

  brokenLinks.innerHTML = results.brokenLinks.length ? '<h4>Broken Links:</h4>' + 
    results.brokenLinks.map(link => `
      <div class="error-item">
        <div><strong>URL:</strong> ${link.url}</div>
        <div><strong>Text:</strong> ${link.text || 'No text'}</div>
        <div><strong>Status:</strong> ${link.statusCode || link.error}</div>
      </div>
    `).join('') : '';

  brokenImages.innerHTML = results.brokenImages.length ? '<h4>Broken Images:</h4>' + 
    results.brokenImages.map(image => `
      <div class="error-item">
        <div><strong>URL:</strong> ${image.url}</div>
        <div><strong>Alt:</strong> ${image.alt || 'No alt text'}</div>
        <div><strong>Status:</strong> ${image.statusCode || image.error}</div>
      </div>
    `).join('') : '';
} 