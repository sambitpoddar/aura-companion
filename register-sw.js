/**
 * AURA Service Worker Registration
 * Registers the SW for PWA offline + install support.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('[AURA] Service Worker registered:', reg.scope);

        // Listen for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[AURA] New version available. Reload to update.');
            }
          });
        });
      })
      .catch(err => console.warn('[AURA] SW registration failed:', err));
  });

  // Handle PWA install prompt
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Show install hint after 10 seconds of use
    setTimeout(() => {
      if (deferredPrompt) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.cssText = 'cursor:pointer;bottom:120px;';
        toast.innerHTML = '📲 Install AURA on your device';
        toast.addEventListener('click', async () => {
          toast.remove();
          deferredPrompt.prompt();
          const result = await deferredPrompt.userChoice;
          deferredPrompt = null;
          console.log('[AURA] Install result:', result.outcome);
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 8000);
      }
    }, 10_000);
  });
}
