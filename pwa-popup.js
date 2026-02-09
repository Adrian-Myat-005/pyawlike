(function() {
    let deferredPrompt;
    const popup = document.getElementById('pwa-install-popup');
    const overlay = document.getElementById('pwa-overlay');
    const installBtn = document.getElementById('pwa-install-btn');
    const cancelBtn = document.getElementById('pwa-cancel-btn');
    const descText = document.getElementById('pwa-desc');

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    function init() {
        if (isStandalone) return; 

        // Platform detection for instructions
        if (isIOS) {
            setupIOSPopup();
        } else {
            setupWebPrompt();
        }
    }

    function setupIOSPopup() {
        setTimeout(() => {
            descText.innerHTML = 'Tap Share <span style="font-size:16px">⎋</span> then "Add to Home Screen" <span style="font-size:16px">⊞</span>';
            installBtn.style.display = 'none'; 
            showPopup();
        }, 2000);
    }

    function setupWebPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            showPopup();
        });

        // Force show after 3 seconds if not already shown (Fallback/Manual)
        setTimeout(() => {
            if (popup.classList.contains('hidden') && !isStandalone) {
                showPopup();
            }
        }, 3000);
    }

    function showPopup() {
        popup.classList.remove('hidden');
        overlay.classList.remove('hidden');
    }

    function dismissPopup() {
        popup.classList.add('hidden');
        overlay.classList.add('hidden');
    }

    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
        } else {
            // Manual fallback if browser doesn't support the trigger
            alert("To install: Open your browser menu (⋮ or ⋯) and look for 'Install App' or 'Add to Home Screen'.");
        }
        dismissPopup();
    });

    cancelBtn.addEventListener('click', dismissPopup);

    window.addEventListener('appinstalled', () => {
        dismissPopup();
        deferredPrompt = null;
    });

    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }
})();