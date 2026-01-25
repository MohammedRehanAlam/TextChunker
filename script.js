/**
 * Text Splitter App Logic
 * Handles state, text processing, persistence, and UI rendering.
 */

// Application State
const state = {
    currentId: null,
    title: "Untitled Project",
    text: "",
    settings: {
        splitLen: 2000,
        prefix: "",
        suffix: ""
    },
    history: [] // Array of { id, title, timestamp, text, settings }
};

// DOM Elements
const elements = {
    input: document.getElementById('main-input'),
    titleDisplay: document.getElementById('project-title-display'),
    titleInput: document.getElementById('project-title-input'),
    editTitleBtn: document.getElementById('edit-title-btn'),
    saveTitleBtn: document.getElementById('save-title-btn'),
    titleContainer: document.getElementById('title-container'),
    lenInput: document.getElementById('length-input'),
    customLenWrapper: document.querySelector('.custom-length-wrapper'),
    prefixInput: document.getElementById('prefix-input'),
    suffixInput: document.getElementById('suffix-input'),
    outputContainer: document.getElementById('output-container'),
    charCount: document.getElementById('char-count'),
    wordCount: document.getElementById('word-count'),
    historyList: document.getElementById('history-list'),
    newChatBtn: document.getElementById('new-chat-btn'),
    presetBtns: document.querySelectorAll('.preset-btn'),
    sidebar: document.getElementById('sidebar'),
    toggleSidebarBtn: document.getElementById('toggle-sidebar'),
    closeSidebarBtn: document.getElementById('close-sidebar-btn')
};

// --- Initialization ---

function init() {
    loadFromLocal();

    // If no current ID (fresh load with no history), create new
    // Smart Session Start
    const latest = state.history[0];
    const isLatestEmpty = latest && !latest.text && latest.title === "Untitled Project";

    if (isLatestEmpty) {
        // Reuse the clean slate (prevents empty duplicates)
        loadProject(latest.id);
    } else {
        // Start fresh (preserve old history safely)
        createNewProject();
    }

    setupEventListeners();
    renderHistory();
}

function setupEventListeners() {
    // Input Text
    elements.input.addEventListener('input', (e) => {
        state.text = e.target.value;
        updateStats();

        // Immediate Save & Rename Logic
        updateCurrentHistoryItem();
        tryAutoRename();

        debounceProcess();
        saveToLocal();
    });

    // Title Edit Logic
    const enableEditMode = () => {
        elements.titleDisplay.style.display = 'none';
        elements.editTitleBtn.style.display = 'none';

        elements.titleInput.style.display = 'block';
        elements.saveTitleBtn.style.display = 'flex'; // flex to center icon

        elements.titleInput.focus();
    };

    const saveTitle = () => {
        const newTitle = elements.titleInput.value.trim() || "Untitled Project";
        state.title = newTitle;
        elements.titleDisplay.textContent = newTitle;

        elements.titleInput.style.display = 'none';
        elements.saveTitleBtn.style.display = 'none';

        elements.titleDisplay.style.display = 'block';
        elements.editTitleBtn.style.display = 'flex';

        updateCurrentHistoryItem();
        saveToLocal();
        renderHistory();
    };

    elements.editTitleBtn.addEventListener('click', enableEditMode);
    elements.titleDisplay.addEventListener('click', enableEditMode);

    elements.saveTitleBtn.addEventListener('click', saveTitle);

    elements.titleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveTitle();
    });

    elements.titleInput.addEventListener('blur', () => {
        // Optional: Save on blur, or just Cancel? Let's Save.
        // Timeout to allow click on save button to register
        setTimeout(saveTitle, 150);
    });

    // Settings
    elements.lenInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val)) return; // Allow typing empty

        updateSettings('splitLen', val);

        // Highlight Custom Wrapper, Deselect Presets
        highlightCustomInput(true);
    });

    elements.lenInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (val < 10) val = 10;
        if (val > 50000) val = 50000;
        elements.lenInput.value = val;
        updateSettings('splitLen', val);
    });

    // Helper for Textarea Tab Support
    const enableTab = (el) => {
        el.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.selectionStart;
                const end = this.selectionEnd;
                // Insert tab character
                this.value = this.value.substring(0, start) + "\t" + this.value.substring(end);
                // Move caret
                this.selectionStart = this.selectionEnd = start + 1;
                // Trigger input event to save
                updateSettings(el.id === 'prefix-input' ? 'prefix' : 'suffix', this.value);
            }
        });
    };

    enableTab(elements.prefixInput);
    enableTab(elements.suffixInput);

    elements.prefixInput.addEventListener('input', (e) => {
        updateSettings('prefix', e.target.value);
        // settings update already calls updateCurrentHistoryItem via updateSettings helper
    });
    elements.suffixInput.addEventListener('input', (e) => {
        updateSettings('suffix', e.target.value);
    });

    // Presets
    elements.presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.val;
            elements.lenInput.value = val;
            updateSettings('splitLen', parseInt(val));

            // UI Active State
            highlightCustomInput(false);
            btn.classList.add('active');
        });
    });

    // Sidebar Actions
    elements.newChatBtn.addEventListener('click', createNewProject);

    // Mobile Sidebar
    elements.toggleSidebarBtn.addEventListener('click', () => {
        elements.sidebar.classList.add('open');
    });

    elements.closeSidebarBtn.addEventListener('click', () => {
        elements.sidebar.classList.remove('open');
    });

    // Click outside settings to close sidebar on mobile (optional UX)
}

// --- core Logic ---

function updateSettings(key, value) {
    state.settings[key] = value;
    updateCurrentHistoryItem(); // Save settings to history item
    saveToLocal();
    debounceProcess();
}

let debounceTimer;
function debounceProcess() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        processText();
    }, 300); // 300ms delay
}

function tryAutoRename() {
    // Only rename if it's still the default title
    if (state.title !== "Untitled Project") return;

    const text = state.text.trim();
    if (text.length < 5) return; // Wait for a bit of substance

    // Extract first few words (approx 25 chars max)
    const words = text.split(/\s+/).slice(0, 5).join(" ");
    let newTitle = words.substring(0, 25);
    if (words.length > 25 || text.length > 25) newTitle += "...";

    // Update State
    state.title = newTitle;

    // Update UI
    elements.titleDisplay.textContent = newTitle;
    elements.titleInput.value = newTitle;

    // Sync History & Sidebar
    updateCurrentHistoryItem();
    renderHistory();
}

function processText() {
    const text = state.text;
    const len = state.settings.splitLen;
    const pre = state.settings.prefix;
    const suf = state.settings.suffix;

    if (!text) {
        elements.outputContainer.innerHTML = '<div style="text-align:center; padding: 40px; color: #555;">Start typing to generate chunks...</div>';
        return;
    }

    const chunks = splitTextSmart(text, len);
    renderChunks(chunks, pre, suf);
}

function splitTextSmart(text, maxLength) {
    const chunks = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
        let chunkEnd = currentIndex + maxLength;

        if (chunkEnd >= text.length) {
            chunks.push(text.slice(currentIndex));
            break;
        }

        // Look for last whitespace before max length to avoid splitting words
        let lastSpace = text.lastIndexOf(' ', chunkEnd);
        let lastNewLine = text.lastIndexOf('\n', chunkEnd);

        // Prioritize clear paragraph breaks if close enough
        let splitIndex = chunkEnd;

        if (lastNewLine > currentIndex + (maxLength * 0.7)) {
            splitIndex = lastNewLine + 1; // Include newline
        } else if (lastSpace > currentIndex + (maxLength * 0.5)) {
            splitIndex = lastSpace + 1; // Include space
        }
        // fallback: hard split at maxLength

        chunks.push(text.slice(currentIndex, splitIndex));
        currentIndex = splitIndex;
    }
    return chunks;
}

// --- UI Rendering ---

function renderChunks(chunks, prefix, suffix) {
    elements.outputContainer.innerHTML = '';
    const template = document.getElementById('chunk-card-template');

    chunks.forEach((chunk, index) => {
        const clone = template.content.cloneNode(true);

        // Process dynamic variables in prefix/suffix
        // Simple interpolation: {i} for index (1-based), {n} for total
        const processedPrefix = prefix.replace(/{i}/g, index + 1).replace(/{n}/g, chunks.length);
        const processedSuffix = suffix.replace(/{i}/g, index + 1).replace(/{n}/g, chunks.length);

        const fullText = `${processedPrefix}${chunk}${processedSuffix}`;

        clone.querySelector('.chunk-index').textContent = `${index + 1} / ${chunks.length}`;
        clone.querySelector('.chunk-len').textContent = `${fullText.length} chars`;
        clone.querySelector('.chunk-content').textContent = fullText;

        // Copy Event
        const copyBtn = clone.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(fullText).then(() => {
                copyBtn.textContent = "Copied!";
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.textContent = "Copy";
                    copyBtn.classList.remove('copied');
                }, 2000);
            });
        });

        elements.outputContainer.appendChild(clone);
    });
}

function updateStats() {
    const len = state.text.length;
    const words = state.text.trim() === '' ? 0 : state.text.trim().split(/\s+/).length;
    elements.charCount.textContent = `${len} chars`;
    elements.wordCount.textContent = `${words} words`;
}

// --- History & Persistence ---

function createNewProject() {
    const newId = Date.now().toString();
    const newItem = {
        id: newId,
        title: "Untitled Project",
        timestamp: Date.now(),
        text: "",
        settings: { ...state.settings } // Copy current settings or reset? User might like sticky settings. Let's copy.
    };

    state.history.unshift(newItem); // Add to top
    loadProject(newId);

    // On mobile, close sidebar
    elements.sidebar.classList.remove('open');
}

function loadProject(id) {
    const project = state.history.find(p => p.id === id);
    if (!project) return;

    state.currentId = project.id;
    state.title = project.title;
    state.text = project.text;
    state.settings = { ...project.settings };

    updateUIValues();
    processText();
    renderHistory();
    saveToLocal();
}

function updateUIValues() {
    elements.input.value = state.text;

    // Title UI Update
    elements.titleDisplay.textContent = state.title;
    elements.titleInput.value = state.title;

    elements.lenInput.value = state.settings.splitLen;
    elements.prefixInput.value = state.settings.prefix;
    elements.suffixInput.value = state.settings.suffix;
    updateStats();

    // Check if current length matches a preset
    const len = state.settings.splitLen;
    const matchingPreset = Array.from(elements.presetBtns).find(btn => parseInt(btn.dataset.val) === len);

    if (matchingPreset) {
        highlightCustomInput(false);
        matchingPreset.classList.add('active');
    } else {
        highlightCustomInput(true);
    }
}

function highlightCustomInput(isCustom) {
    if (isCustom) {
        elements.customLenWrapper.classList.add('active');
        elements.presetBtns.forEach(b => b.classList.remove('active'));
    } else {
        elements.customLenWrapper.classList.remove('active');
        elements.presetBtns.forEach(b => b.classList.remove('active'));
    }
}

function updateCurrentHistoryItem() {
    const index = state.history.findIndex(p => p.id === state.currentId);
    if (index !== -1) {
        state.history[index] = {
            ...state.history[index],
            title: state.title,
            text: state.text,
            settings: { ...state.settings },
            timestamp: Date.now()
        };
        // Move to top? Optionally.
    }
}

function deleteHistoryItem(id, e) {
    if (e) e.stopPropagation();
    if (!confirm("Delete this project?")) return;

    state.history = state.history.filter(p => p.id !== id);

    if (state.currentId === id) {
        if (state.history.length > 0) {
            loadProject(state.history[0].id);
        } else {
            createNewProject();
        }
    } else {
        renderHistory();
        saveToLocal();
    }
}

function renameHistoryItem(id, newTitle) {
    const index = state.history.findIndex(p => p.id === id);
    if (index !== -1) {
        state.history[index].title = newTitle;
        if (state.currentId === id) {
            state.title = newTitle;
            elements.titleDisplay.textContent = newTitle;
            elements.titleInput.value = newTitle;
        }
        saveToLocal();
        renderHistory();
    }
}

function renderHistory() {
    elements.historyList.innerHTML = '';

    state.history.forEach(item => {
        const div = document.createElement('div');
        div.className = `history-item ${item.id === state.currentId ? 'active' : ''}`;

        // If this specific item is in "editing" mode (we'll use a temp Set or just direct DOM manipulation, 
        // but since we re-render often, let's allow ad-hoc editing by replacing content on click)
        // Actually, let's keep it simple: Click rename -> Replace DOM content

        // View Mode Content
        const viewMode = document.createElement('div');
        viewMode.style.display = 'flex';
        viewMode.style.width = '100%';
        viewMode.style.justifyContent = 'space-between';
        viewMode.style.alignItems = 'center';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'history-title';
        titleSpan.textContent = item.title || "Untitled";

        // Actions
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'history-actions';

        const renameBtn = document.createElement('span');
        renameBtn.textContent = '✎';
        renameBtn.className = 'action-icon';
        renameBtn.title = 'Rename';

        // Inline Edit Logic
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            enterSidebarEditMode(div, item);
        };

        const deleteBtn = document.createElement('span');
        deleteBtn.textContent = '×';
        deleteBtn.className = 'action-icon';
        deleteBtn.title = 'Delete';
        deleteBtn.onclick = (e) => deleteHistoryItem(item.id, e);

        actionsDiv.appendChild(renameBtn);
        actionsDiv.appendChild(deleteBtn);

        viewMode.appendChild(titleSpan);
        viewMode.appendChild(actionsDiv);

        div.appendChild(viewMode);

        // Load click
        div.addEventListener('click', (e) => {
            // Don't load if we are editing (input click)
            if (e.target.tagName === 'INPUT' || e.target.closest('.history-confirm-btn')) return;
            loadProject(item.id);
        });

        elements.historyList.appendChild(div);
    });
}

function enterSidebarEditMode(divContainer, item) {
    divContainer.innerHTML = ''; // Clear current content
    divContainer.classList.add('editing');

    // Create Input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = item.title;
    input.className = 'history-edit-input';
    input.maxLength = 50;

    // Save Action
    const confirmBtn = document.createElement('button');
    confirmBtn.innerHTML = '✓';
    confirmBtn.className = 'history-confirm-btn';

    const save = (e) => {
        if (e) e.stopPropagation();
        const newTitle = input.value.trim() || "Untitled";

        // If current project, update main title too
        if (state.currentId === item.id) {
            state.title = newTitle;
            elements.titleDisplay.textContent = newTitle;
            elements.titleInput.value = newTitle;
        }

        renameHistoryItem(item.id, newTitle);
        // renderHistory is called inside renameHistoryItem, which restores view mode
    };

    confirmBtn.onclick = save;

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save(e);
    });

    // Blur to save/cancel? Let's save on blur for convenience
    input.addEventListener('blur', () => {
        setTimeout(() => save(), 150);
    });

    // Assemble
    divContainer.appendChild(input);
    divContainer.appendChild(confirmBtn);

    input.focus();
}

// --- Persistence ---

function saveToLocal() {
    localStorage.setItem('textSplitterApp_v1', JSON.stringify(state));
}

function loadFromLocal() {
    const raw = localStorage.getItem('textSplitterApp_v1');
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            state.history = parsed.history || [];
            /* state.currentId = parsed.currentId; */
            // Smart Session Start: Don't restore currentId, let init() decide.
            // Note: we don't blindly load 'state.text' etc because we want to load based on currentId
            // But we can fall back to the saved state properties if we want to restore *exactly* where they left off
            // Let's rely on finding the project by currentId in history.
            if (state.history.length > 0 && !state.history.find(x => x.id === state.currentId)) {
                // ID mismatch, just load first
                state.currentId = state.history[0].id;
            }
        } catch (e) {
            console.error("Failed to load save", e);
        }
    }
}

// Start
init();
