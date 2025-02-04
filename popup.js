// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Load previous state if exists
  chrome.storage.local.get(['scanResults'], (data) => {
    if (data.scanResults) {
      displayResults(data.scanResults);
    }
  });

  document.getElementById('scanButton').addEventListener('click', async () => {
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const progress = document.getElementById('progress');
    
    if (!loading || !results || !progress) {
      console.error('Required DOM elements not found');
      return;
    }
    
    loading.style.display = 'block';
    results.style.display = 'none';
    
    // Initialize progress display
    loading.innerHTML = `
      <div class="progress-wheel"></div>
      <div class="progress-text">Scanning page...</div>
      <div id="progress" class="progress-text">
        Links: 0/0<br>Images: 0/0
      </div>
    `;
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: 'scan' }).catch(error => {
          loading.innerHTML = `
            <div style="color: red; margin-top: 10px;">
              Error: Could not connect to page. Please refresh the page and try again.
            </div>
          `;
        });
      }
    } catch (error) {
      loading.innerHTML = `
        <div style="color: red; margin-top: 10px;">
          Error: ${error.message}
        </div>
      `;
    }
  });

  // Close button handler
  document.getElementById('closePopup').addEventListener('click', () => {
    chrome.storage.local.remove(['scanResults'], () => {
      window.close();
    });
  });
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'scanComplete':
      // Save results
      chrome.storage.local.set({ scanResults: message.results });
      displayResults(message.results);
      break;
    
    case 'scanProgress':
      updateProgress(message.progress);
      break;
    
    case 'scanError':
      handleError(message.error);
      break;
  }
});

function updateProgress(progress) {
  const progressElement = document.getElementById('progress');
  if (progressElement) {
    progressElement.innerHTML = `
      Links: ${progress.links}/${progress.totalLinks}<br>
      Images: ${progress.images}/${progress.totalImages}
    `;
  }
}

function handleError(error) {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.innerHTML = `
      <div style="color: red; margin-top: 10px;">
        Error scanning page: ${error}
      </div>
    `;
  }
}

function displayResults(results) {
  const loading = document.getElementById('loading');
  const resultsDiv = document.getElementById('results');
  const summary = document.getElementById('summary');
  const brokenLinks = document.getElementById('brokenLinks');
  const brokenImages = document.getElementById('brokenImages');

  if (!loading || !resultsDiv || !summary || !brokenLinks || !brokenImages) {
    console.error('Required DOM elements not found');
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
    resultsDiv.innerHTML += '<p style="color: green">No broken links or images found!</p>';
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