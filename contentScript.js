// At the top of the file, establish connection with background script
const port = chrome.runtime.connect({ name: 'content' });

class LinkScanner {
  constructor() {
    this.abortController = null;
  }

  async scanPage() {
    this.abortController = new AbortController();
    
    const links = Array.from(document.getElementsByTagName('a'));
    const images = Array.from(document.getElementsByTagName('img'));
    
    const results = {
      brokenLinks: [],
      brokenImages: [],
      totalLinks: links.length,
      totalImages: images.length,
      scannedLinks: 0,
      scannedImages: 0
    };

    // Helper function to check URL validity
    const isValidUrl = (url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    // Helper function to check if URL is same origin
    const isSameOrigin = (url) => {
      try {
        const currentOrigin = window.location.origin;
        const targetOrigin = new URL(url).origin;
        return currentOrigin === targetOrigin;
      } catch {
        return false;
      }
    };

    // Helper function to safely fetch a URL
    const safeFetch = async (url, options = {}) => {
      try {
        if (!isValidUrl(url)) {
          throw new Error('Invalid URL');
        }

        // For same-origin requests, we can do a full check
        if (isSameOrigin(url)) {
          const response = await fetch(url, {
            method: 'HEAD',
            signal: this.abortController.signal,
            ...options
          });
          return response;
        } else {
          // For cross-origin requests, use img/script tag to check existence
          return new Promise((resolve, reject) => {
            const tag = url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? 'img' : 'script';
            const element = document.createElement(tag);
            const timeoutId = setTimeout(() => {
              cleanup();
              reject(new Error('Timeout'));
            }, 5000);

            const cleanup = () => {
              clearTimeout(timeoutId);
              element.remove();
            };

            element.onload = () => {
              cleanup();
              resolve({ ok: true, status: 200 });
            };

            element.onerror = () => {
              cleanup();
              reject(new Error('Resource unavailable'));
            };

            element.src = url;
            if (tag === 'script') {
              element.async = true;
            }
            document.head.appendChild(element);
          });
        }
      } catch (error) {
        throw error;
      }
    };

    // Process links in batches
    const batchSize = 5;
    for (let i = 0; i < links.length; i += batchSize) {
      if (this.abortController.signal.aborted) {
        throw new Error('Scan aborted');
      }

      const batch = links.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(async (link) => {
        try {
          const url = link.href;
          if (!url || url.startsWith('javascript:') || url.startsWith('#') || url.startsWith('mailto:')) {
            return;
          }

          const response = await safeFetch(url);
          if (!response.ok) {
            results.brokenLinks.push({
              url: url,
              text: link.textContent.trim().substring(0, 50),
              statusCode: response.status
            });
          }
        } catch (error) {
          results.brokenLinks.push({
            url: link.href,
            text: link.textContent.trim().substring(0, 50),
            error: error.message
          });
        } finally {
          results.scannedLinks++;
          chrome.runtime.sendMessage({
            action: 'scanProgress',
            progress: {
              links: results.scannedLinks,
              images: results.scannedImages,
              totalLinks: results.totalLinks,
              totalImages: results.totalImages
            }
          });
        }
      }));

      // Small delay between batches to prevent overwhelming the browser
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Process images similarly
    for (let i = 0; i < images.length; i += batchSize) {
      if (this.abortController.signal.aborted) {
        throw new Error('Scan aborted');
      }

      const batch = images.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(async (img) => {
        try {
          const url = img.src;
          if (!url || url.startsWith('data:')) {
            return;
          }

          const response = await safeFetch(url);
          if (!response.ok) {
            results.brokenImages.push({
              url: url,
              alt: img.alt,
              statusCode: response.status
            });
          }
        } catch (error) {
          results.brokenImages.push({
            url: img.src,
            alt: img.alt,
            error: error.message
          });
        } finally {
          results.scannedImages++;
          chrome.runtime.sendMessage({
            action: 'scanProgress',
            progress: {
              links: results.scannedLinks,
              images: results.scannedImages,
              totalLinks: results.totalLinks,
              totalImages: results.totalImages
            }
          });
        }
      }));

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}

// Initialize scanner and listen for messages
const scanner = new LinkScanner();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scan') {
    scanPage();
  } else if (request.action === 'abort') {
    scanner.abort();
  }
  return false; // Don't keep message channel open
});

async function scanPage() {
  const links = Array.from(document.getElementsByTagName('a'));
  const images = Array.from(document.getElementsByTagName('img'));
  
  const results = {
    brokenLinks: [],
    brokenImages: [],
    totalLinks: links.length,
    totalImages: images.length
  };

  let scannedLinks = 0;
  let scannedImages = 0;

  // Check links in batches
  const batchSize = 5;
  for (let i = 0; i < links.length; i += batchSize) {
    const batch = links.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(async (link) => {
      try {
        const url = link.href;
        if (!url || url.startsWith('javascript:') || url.startsWith('#') || url.startsWith('mailto:')) {
          return;
        }

        const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
        if (!response.ok) {
          results.brokenLinks.push({
            url: url,
            text: link.textContent.trim(),
            statusCode: response.status
          });
        }
      } catch (error) {
        results.brokenLinks.push({
          url: link.href,
          text: link.textContent.trim(),
          error: error.message
        });
      }
      scannedLinks++;
      chrome.runtime.sendMessage({
        action: 'scanProgress',
        progress: {
          links: scannedLinks,
          images: scannedImages,
          totalLinks: links.length,
          totalImages: images.length
        }
      });
    }));
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Check images in batches
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(async (img) => {
      try {
        const url = img.src;
        if (!url || url.startsWith('data:')) {
          return;
        }

        const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
        if (!response.ok) {
          results.brokenImages.push({
            url: url,
            alt: img.alt,
            statusCode: response.status
          });
        }
      } catch (error) {
        results.brokenImages.push({
          url: img.src,
          alt: img.alt,
          error: error.message
        });
      }
      scannedImages++;
      chrome.runtime.sendMessage({
        action: 'scanProgress',
        progress: {
          links: scannedLinks,
          images: scannedImages,
          totalLinks: links.length,
          totalImages: images.length
        }
      });
    }));
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Send final results
  chrome.runtime.sendMessage({
    action: 'scanComplete',
    results: results
  });
} 