/**
 * Smart PWA Install Popup Module
 * UX Strategy: Non-intrusive, Platform-aware, Contextual.
 */
(function() {
    let deferredPrompt;
    const popup = document.getElementById('pwa-install-popup');
    const installBtn = document.getElementById('pwa-install-btn');
    const cancelBtn = document.getElementById('pwa-cancel-btn');
    const descText = document.getElementById('pwa-desc');

    const STORAGE_KEY = 'pwa_popup_dismissed';
    const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 Hours

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    // 1. Core Logic: Should we show it?
    function init() {
        if (isStandalone) return; // Already installed

        const dismissedAt = localStorage.getItem(STORAGE_KEY);
        if (dismissedAt && (Date.now() - dismissedAt < COOLDOWN_MS)) return;

        // Platform detection for instructions
        if (isIOS) {
            setupIOSPopup();
        } else {
            setupWebPrompt();
        }
    }

    function setupIOSPopup() {
        setTimeout(() => {
            descText.innerHTML = 'Tap the Share icon <span style="font-size:16px">⎋</span>, then select "Add to Home Screen" <span style="font-size:16px">⊞</span>';
            installBtn.style.display = 'none'; // iOS can't trigger native prompt via button
            showPopup();
        }, 2000);
    }

    function setupWebPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            showPopup();
        });

        // Fallback for desktop or browsers that don't fire beforeinstallprompt immediately
        setTimeout(() => {
            if (!deferredPrompt && !isIOS && !isStandalone) {
                // If we still don't have a prompt, show it as an info popup
                descText.innerText = "Install the app for a faster, full-screen experience.";
                installBtn.innerText = "How to Install";
                installBtn.onclick = () => {
                    alert("To install: Click the browser menu (⋮ or ⋯) and select 'Install' or 'Add to Home Screen'.");
                };
                showPopup();
            }
        }, 5000);
    }

    function showPopup() {
        popup.classList.remove('hidden');
    }

    function dismissPopup() {
        popup.classList.add('hidden');
        localStorage.setItem(STORAGE_KEY, Date.now());
    }

    // 2. Event Listeners
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('User accepted the PWA install');
        }
        deferredPrompt = null;
        popup.classList.add('hidden');
    });

    cancelBtn.addEventListener('click', dismissPopup);

    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        popup.classList.add('hidden');
        deferredPrompt = null;
    });

    // Run
    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }
})();
