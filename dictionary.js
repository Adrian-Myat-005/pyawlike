(function() {
    const dicPopup = document.getElementById('dic-popup');
    const speakerWrapper = document.getElementById('speakerWrapper');
    const closeDic = document.getElementById('closeDic');
    const dicBackBtn = document.getElementById('dicBackBtn');
    const dicOriginal = document.getElementById('dicOriginal');
    const dicTranslated = document.getElementById('dicTranslated');
    const dicExamples = document.getElementById('dicExamples');
    const dicSynonyms = document.getElementById('dicSynonyms');
    const dicAntonyms = document.getElementById('dicAntonyms');
    const dicAcronyms = document.getElementById('dicAcronyms');
    const kbInputContainer = document.getElementById('kbInputContainer');
    const kbInput = document.getElementById('kb-input');
    const kbSuggestions = document.getElementById('kb-suggestions');
    const searchLoader = document.getElementById('searchLoader');
    const dicHomeScreen = document.getElementById('dic-home-screen');
    const dicRecentWords = document.getElementById('dicRecentWords');
    const dicWordSection = document.getElementById('dicWordSection');
    const searchLangBtn = document.getElementById('searchLangBtn');
    const searchMicBtn = document.getElementById('searchMicBtn');
    const customKeyboard = document.getElementById('custom-keyboard');
    const kbCircle = document.getElementById('kbCircle');

    const clickSound = new Audio('click_eff.mp3');
    function playClickSound() {
        clickSound.currentTime = 0;
        clickSound.play().catch(e => {});
    }

    let dicHistory = [];
    let kbLanguage = 'ENG'; 

    async function openDictionary(word = "") {
        dicPopup.classList.add('open');
        kbInputContainer.classList.add('visible');
        if (word) searchWord(word); else showHomeScreen();
    }

    async function showHomeScreen() {
        dicWordSection.style.display = 'none';
        dicHomeScreen.style.display = 'block';
        dicBackBtn.style.visibility = 'visible';
        dicBackBtn.innerHTML = '★';
        dicBackBtn.style.color = '#d4af37';
        try {
            const res = await fetch('/api/lookup?type=feed');
            if (res.ok) {
                const data = await res.json();
                renderFeed(data.words);
            }
        } catch (e) {}
    }

    function renderFeed(words) {
        if (!words || words.length === 0) {
            dicRecentWords.innerHTML = "<div style='opacity:0.5; font-size:12px; text-align:center;'>Feed is empty. Start searching!</div>";
            return;
        }
        dicRecentWords.innerHTML = words.map(w => `
            <div class="word-card" onclick="window.dictionarySearch('${String(w.word).replace(/'/g, "\\'")}')">
                <div class="card-top">
                    <div class="card-word">${w.word}</div>
                    <div class="card-trans">${w.translation}</div>
                </div>
            </div>
        `).join('');
    }

    window.dictionarySearch = (word) => {
        // CLOSE OVERLAPS
        kbSuggestions.classList.remove('visible');
        searchWord(word);
    };
    
    window.toggleSection = (id) => {
        const content = document.getElementById(id);
        const header = content.previousElementSibling;
        content.classList.toggle('collapsed');
        header.classList.toggle('collapsed');
    };

    window.toggleLang = (btn) => {
        const block = btn.closest('.meaning-block');
        const en = block.querySelector('.def-en');
        const mm = block.querySelector('.def-mm');
        const isEn = en.style.display !== 'none';
        en.style.display = isEn ? 'none' : 'block';
        mm.style.display = isEn ? 'block' : 'none';
        btn.innerText = isEn ? 'EN' : 'MM';
    };

    window.toggleStar = (word, trans) => {
        let starred = JSON.parse(localStorage.getItem('starred_vocabs') || '[]');
        const index = starred.findIndex(item => item.word === word);
        if (index > -1) {
            starred.splice(index, 1);
        } else {
            starred.push({ word, trans, time: Date.now() });
        }
        localStorage.setItem('starred_vocabs', JSON.stringify(starred));
        renderStarIcon(word);
        if (window.renderStarredList) window.renderStarredList();
    };

    function renderStarIcon(word) {
        const starred = JSON.parse(localStorage.getItem('starred_vocabs') || '[]');
        const isStarred = starred.some(item => item.word === word);
        const starBtn = document.getElementById('starWordBtn');
        if (starBtn) {
            starBtn.classList.toggle('active', isStarred);
            starBtn.innerHTML = isStarred ? '★' : '☆';
            starBtn.style.color = isStarred ? '#d4af37' : 'inherit';
        }
    }

    async function searchWord(word, saveToHist = true) {
        if (!word) return;
        if (saveToHist && dicHistory[dicHistory.length - 1] !== word) dicHistory.push(word);
        
        customKeyboard.classList.remove('open');
        kbSuggestions.classList.remove('visible');

        searchLoader.classList.add('visible');
        dicPopup.classList.add('loading');
        dicHomeScreen.style.display = 'none';
        dicWordSection.style.display = 'block';
        updateBackBtn();
        
        try {
            const res = await fetch(`/api/lookup?word=${encodeURIComponent(word)}`);
            if (res.ok) {
                const data = await res.json();
                
                // Update Back Button to Arrow
                dicBackBtn.innerHTML = '←';
                dicBackBtn.style.color = 'inherit';

                // 1. Header (Original + Translation + Star)
                let html = `
                    <div class="dic-word-row">
                        <div class="dic-original">${data.original}</div>
                        <div style="display:flex; gap:10px;">
                            <div id="starWordBtn" class="star-btn" onclick="window.toggleStar('${String(data.original).replace(/'/g, "\\'")}', '${String(data.translated).replace(/'/g, "\\'")}')">☆</div>
                            <div class="audio-btn" onclick="window.playText('${String(data.original).replace(/'/g, "\\'")}')">
                                <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                            </div>
                        </div>
                    </div>
                    <div class="dic-word-row" style="margin-top: 5px; margin-bottom: 20px;">
                        <div class="dic-translated">${data.translated}</div>
                        <div class="audio-btn mini" onclick="window.playText('${String(data.translated).replace(/'/g, "\\'")}')">
                            <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                        </div>
                    </div>
                `;

                // 2. Meanings Section
                const meaningsHtml = (data.meanings || []).map((m, mi) => `
                    <div class="meaning-block">
                        <div class="meaning-block-header">
                            <div class="part-of-speech">${m.partOfSpeech}</div>
                            <div class="lang-switch" onclick="window.toggleLang(this)">MM</div>
                        </div>
                        ${(m.definitions || []).map(d => `
                            <div class="definition-container">
                                <div class="def-en">• ${d.en}</div>
                                <div class="def-mm" style="display:none">• ${d.mm}</div>
                            </div>
                        `).join('')}
                    </div>
                `).join('');
                
                html += `
                    <div class="collapsible-section">
                        <div class="section-header" onclick="window.toggleSection('sec-meanings')">Definitions <span class="toggle-icon">▾</span></div>
                        <div id="sec-meanings" class="section-content">${meaningsHtml || '<p style="opacity:0.5; font-size:12px;">No definitions found.</p>'}</div>
                    </div>
                `;

                // 3. Examples Section
                const examplesHtml = (data.examples || []).map(ex => `
                    <div class="example-row">
                        <div class="example-text">${ex}</div>
                        <div class="audio-btn mini" onclick="window.playText(\`${ex.replace(/'/g, "\\'").replace(/"/g, '&quot;')}\`)">
                            <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                        </div>
                    </div>
                `).join('');

                html += `
                    <div class="collapsible-section">
                        <div class="section-header" onclick="window.toggleSection('sec-examples')">Examples <span class="toggle-icon">▾</span></div>
                        <div id="sec-examples" class="section-content">${examplesHtml || '<p style="opacity:0.5; font-size:12px;">No examples found.</p>'}</div>
                    </div>
                `;

                // 4. Relations Section (Synonyms, Antonyms, Acronyms)
                const rendRel = (list, title) => {
                    if (!list || list.length === 0) return "";
                    return `
                        <div class="relation-sub-box">
                            <div class="relation-title">${title}</div>
                            <div class="relation-list">${list.map(w => {
                                const wordStr = String(w);
                                return `<div class="relation-word" onclick="window.dictionarySearch('${wordStr.replace(/'/g, "\\'")}')">${wordStr}</div>`;
                            }).join('')}</div>
                        </div>
                    `;
                };

                const relHtml = rendRel(data.synonyms, "Same") + rendRel(data.antonyms, "Opposite") + rendRel(data.acronyms, "Acronym");

                html += `
                    <div class="collapsible-section">
                        <div class="section-header collapsed" onclick="window.toggleSection('sec-relations')">Related <span class="toggle-icon">▾</span></div>
                        <div id="sec-relations" class="section-content collapsed">${relHtml || '<p style="opacity:0.5; font-size:12px;">No related words found.</p>'}</div>
                    </div>
                `;

                dicWordSection.innerHTML = html;
                renderStarIcon(data.original);
                
                // --- AUTO PLAY VOICE ---
                window.playText(data.original);
                setTimeout(() => window.playText(data.translated), 1200);
            }
        } catch (e) { console.error(e); } finally { 
            dicPopup.classList.remove('loading'); 
            searchLoader.classList.remove('visible'); 
        }
    }

    window.playText = (text) => {
        const isMM = /[\u1000-\u109F]/.test(text);
        const lang = isMM ? 'my' : 'en';
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
        new Audio(url).play().catch(e => {
            console.error("Direct TTS failed, trying proxy...");
            fetch(`/api/edge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice: isMM ? 'my-MM-NilarNeural' : 'en-US-AvaNeural' }) })
                .then(res => res.blob()).then(blob => new Audio(URL.createObjectURL(blob)).play());
        });
    };

    // --- AUDIO BUTTON LOGIC ---
    // Removed specific element click listeners as they are now handled by inline onclick in dynamic HTML

    searchLangBtn.addEventListener('click', () => { kbLanguage = kbLanguage === 'ENG' ? 'MM' : 'ENG'; searchLangBtn.innerText = kbLanguage; kbInput.placeholder = kbLanguage === 'ENG' ? 'Type word...' : 'စာရိုက်ပါ...'; });
    
    searchMicBtn.addEventListener('click', () => {
        playClickSound();
        startVoiceSearch();
    });

    function startVoiceSearch() {
        const Speech = window.webkitSpeechRecognition || window.speechRecognition;
        if (!Speech) return;
        const rec = new Speech();
        rec.lang = kbLanguage === 'ENG' ? 'en-US' : 'my-MM';
        rec.onstart = () => { 
            searchMicBtn.classList.add('recording'); 
            kbInput.placeholder = kbLanguage === 'ENG' ? "Listening..." : "နားထောင်နေသည်...";
        };
        rec.onresult = (ev) => searchWord(ev.results[0][0].transcript);
        rec.onend = () => { searchMicBtn.classList.remove('recording'); kbInput.placeholder = kbLanguage === 'ENG' ? "Type word..." : "စာရိုက်ပါ..."; };
        rec.start();
    }

    closeDic.addEventListener('click', () => { dicPopup.classList.remove('open'); kbInputContainer.classList.remove('visible'); });
    
    kbInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            searchWord(kbInput.value);
            kbInput.blur();
        }
    });

    dicBackBtn.addEventListener('click', () => { 
        // IF HOME SCREEN: OPEN STARRED LIST
        if (dicHomeScreen.style.display !== 'none') {
            playClickSound();
            document.getElementById('starredPage').classList.add('open');
            if (window.renderStarredList) window.renderStarredList();
            return;
        }

        // IF WORD VIEW: GO BACK
        if (dicHistory.length > 1) { 
            dicHistory.pop(); 
            searchWord(dicHistory.pop(), true); 
        } else { 
            dicHistory = [];
            showHomeScreen(); 
        } 
    });
    function updateBackBtn() { 
        // Always show back button if we are in the word section
        dicBackBtn.style.visibility = 'visible'; 
    }

    // TRIPLE TAP TO OPEN
    let lastTap = 0;
    let tapCount = 0;
    const handleTapGesture = (e) => {
        if (e.target !== document.body || dicPopup.classList.contains('open')) return;
        const now = Date.now();
        if (now - lastTap < 400) {
            tapCount++;
            if (tapCount === 3) {
                tapCount = 0;
                openDictionary();
            }
        } else {
            tapCount = 1;
        }
        lastTap = now;
    };
    document.addEventListener('touchstart', handleTapGesture, { passive: true });
    document.addEventListener('mousedown', (e) => { if (e.button === 0) handleTapGesture(e); });

    kbInput.addEventListener('input', async () => {
        if (kbInput.value.trim()) {
            const r = await fetch(`https://api.datamuse.com/words?sp=${kbInput.value}*&max=5`);
            const d = await r.json();
            kbSuggestions.innerHTML = d.map(i => `<div class="suggestion-item" onclick="window.dictionarySearch('${i.word.replace(/'/g, "\\'")}'); document.getElementById('kb-input').value='';">${i.word}</div>`).join('');
            kbSuggestions.classList.add('visible');
        } else kbSuggestions.classList.remove('visible');
    });

})();
