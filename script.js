import { auth, provider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, db, collection, doc, setDoc, getDocs, deleteDoc, query, where } from './firebase-module.js';

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
    history: [], // Array of { id, title, timestamp, text, settings }
    authMode: 'login' // 'login' or 'signup'
};

let currentUser = null;
let currentStorageKey = 'textSplitterApp_guest_v1';

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
    closeSidebarBtn: document.getElementById('close-sidebar-btn'),
    // Auth Elements
    authOverlay: document.getElementById('auth-overlay'),
    tabLogin: document.getElementById('tab-login'),
    tabSignup: document.getElementById('tab-signup'),
    authForm: document.getElementById('auth-form'),
    authEmail: document.getElementById('auth-email'),
    authPassword: document.getElementById('auth-password'),
    authSubmitBtn: document.getElementById('auth-submit-btn'),
    googleLoginBtnMain: document.getElementById('google-login-btn-main'),
    skipAuthBtn: document.getElementById('skip-auth-btn'),
    authErrorMsg: document.getElementById('auth-error-msg'),
    // Sidebar Auth
    loginBtn: document.getElementById('login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    userInfo: document.getElementById('user-info'),
    userAvatar: document.getElementById('user-avatar'),
    userName: document.getElementById('user-name')
};

// --- Initialization ---

function init() {
    // Initial load as guest
    loadFromLocal(currentStorageKey);
    renderHistory();

    // Auth listeners
    setupAuthListeners();
    setupAuthUIListeners();
    setupEventListeners();

    // Note: We wait for auth state to determine final storage key and data
}

function setupAuthUIListeners() {
    // Tabs
    elements.tabLogin.addEventListener('click', () => toggleAuthMode('login'));
    elements.tabSignup.addEventListener('click', () => toggleAuthMode('signup'));

    // Form Submit
    elements.authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = elements.authEmail.value;
        const password = elements.authPassword.value;
        elements.authErrorMsg.style.display = 'none';

        try {
            if (state.authMode === 'login') {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (error) {
            console.error("Auth error", error);
            elements.authErrorMsg.textContent = error.message;
            elements.authErrorMsg.style.display = 'block';
        }
    });

    // Google Login (Overlay)
    elements.googleLoginBtnMain.addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Login failed", error);
            elements.authErrorMsg.textContent = error.message;
            elements.authErrorMsg.style.display = 'block';
        }
    });

    // Sidebar Login Button
    if (elements.loginBtn) {
        elements.loginBtn.addEventListener('click', () => {
            elements.authOverlay.classList.add('active');
        });
    }

    // Skip Auth
    elements.skipAuthBtn.addEventListener('click', () => {
        elements.authOverlay.classList.remove('active');
        localStorage.setItem('skippedAuth', 'true');
        // Stay on guest key
    });
}

function toggleAuthMode(mode) {
    state.authMode = mode;
    if (mode === 'login') {
        elements.tabLogin.classList.add('active');
        elements.tabSignup.classList.remove('active');
        elements.authSubmitBtn.textContent = 'Login';
    } else {
        elements.tabLogin.classList.remove('active');
        elements.tabSignup.classList.add('active');
        elements.authSubmitBtn.textContent = 'Sign Up';
    }
}

function setupAuthListeners() {
    // Logout Button
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                // Auth state listener handles the rest
            } catch (error) {
                console.error("Logout failed", error);
            }
        });
    }

    // Auth State Change
    onAuthStateChanged(auth, async (user) => {
        currentUser = user; // updates global var
        updateAuthUI(user);

        if (user) {
            console.log("User signed in:", user.uid);
            // 1. Switch to user storage key
            currentStorageKey = `textSplitterApp_user_${user.uid}`;

            // 2. Load local cache for this user (if any)
            loadFromLocal(currentStorageKey);

            // 3. Clear UI from overlay
            elements.authOverlay.classList.remove('active');
            localStorage.removeItem('skippedAuth');

            // 4. Reset ID if not valid for this user or create new
            if (!state.currentId || !state.history.find(p => p.id === state.currentId)) {
                if (state.history.length > 0) {
                    loadProject(state.history[0].id);
                } else {
                    createNewProject();
                }
            } else {
                // Refresh view
                loadProject(state.currentId);
            }

            // 5. Sync Cloud
            await syncCloudData(user);

        } else {
            console.log("User signed out");
            // 1. Switch to guest storage key
            currentStorageKey = 'textSplitterApp_guest_v1';

            // 2. Load guest data
            loadFromLocal(currentStorageKey);

            // 3. Reset View
            if (state.history.length > 0) {
                loadProject(state.history[0].id);
            } else {
                createNewProject(); // Creates empty guest project
            }

            // 4. Show Auth Overlay if not skipped
            const skipped = localStorage.getItem('skippedAuth');
            if (!skipped) {
                elements.authOverlay.classList.add('active');
            }
        }
    });
}

function updateAuthUI(user) {
    if (user) {
        elements.loginBtn.style.display = 'none';
        elements.userInfo.style.display = 'flex';
        elements.userName.textContent = user.displayName || user.email;
        elements.userAvatar.src = user.photoURL || 'https://via.placeholder.com/32';
    } else {
        elements.loginBtn.style.display = 'flex';
        elements.userInfo.style.display = 'none';
    }
}

async function syncCloudData(user) {
    if (!user) return;

    // 1. Fetch cloud projects
    const q = query(collection(db, `users/${user.uid}/projects`));
    const querySnapshot = await getDocs(q);
    const cloudProjects = [];
    querySnapshot.forEach((doc) => {
        cloudProjects.push(doc.data());
    });

    // 2. Merge logic (simple: union by ID)
    let hasChanges = false;
    cloudProjects.forEach(cp => {
        if (!state.history.find(p => p.id === cp.id)) {
            state.history.push(cp);
            hasChanges = true;
        } else {
            // Optional: Update local if cloud is newer? 
            // For now, keep simple. Cloud wins? Or timestamp?
            // Let's assume cloud is truth source for existence.
            // If we want real sync, we need timestamps.
            // state.history is already sorted by timestamp.
        }
    });

    // 3. Sort and Save
    if (hasChanges) {
        state.history.sort((a, b) => b.timestamp - a.timestamp);
        // Refresh view if current project was added/updated?
        renderHistory();
        saveAll();
    }
}

async function saveToCloud(project) {
    if (!currentUser) return;
    try {
        await setDoc(doc(db, `users/${currentUser.uid}/projects`, project.id), project);
        // console.log("Saved to cloud");
    } catch (e) {
        console.error("Error saving to cloud", e);
    }
}

async function deleteFromCloud(projectId) {
    if (!currentUser) return;
    try {
        await deleteDoc(doc(db, `users/${currentUser.uid}/projects`, projectId));
        console.log("Deleted from cloud");
    } catch (e) {
        console.error("Error deleting from cloud", e);
    }
}

function setupEventListeners() {
    // Input Text
    elements.input.addEventListener('input', (e) => {
        state.text = e.target.value;
        updateStats();
        updateCurrentHistoryItem();
        tryAutoRename();
        debounceProcess();
        saveAll();
    });

    // Title Edit Logic
    const enableEditMode = () => {
        elements.titleDisplay.style.display = 'none';
        elements.editTitleBtn.style.display = 'none';
        elements.titleInput.style.display = 'block';
        elements.saveTitleBtn.style.display = 'flex';
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
        saveAll();
        renderHistory();
    };

    elements.editTitleBtn.addEventListener('click', enableEditMode);
    elements.titleDisplay.addEventListener('click', enableEditMode);
    elements.saveTitleBtn.addEventListener('click', saveTitle);

    elements.titleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveTitle();
    });

    elements.titleInput.addEventListener('blur', () => {
        setTimeout(saveTitle, 150);
    });

    // Settings
    elements.lenInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val)) return;
        updateSettings('splitLen', val);
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
                this.value = this.value.substring(0, start) + "\t" + this.value.substring(end);
                this.selectionStart = this.selectionEnd = start + 1;
                updateSettings(el.id === 'prefix-input' ? 'prefix' : 'suffix', this.value);
            }
        });
    };

    enableTab(elements.prefixInput);
    enableTab(elements.suffixInput);

    elements.prefixInput.addEventListener('input', (e) => {
        updateSettings('prefix', e.target.value);
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
}

// --- core Logic ---

function updateSettings(key, value) {
    state.settings[key] = value;
    updateCurrentHistoryItem();
    saveAll();
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
    if (state.title !== "Untitled Project") return;

    const text = state.text.trim();
    if (text.length < 5) return;

    const words = text.split(/\s+/).slice(0, 5).join(" ");
    let newTitle = words.substring(0, 25);
    if (words.length > 25 || text.length > 25) newTitle += "...";

    state.title = newTitle;
    elements.titleDisplay.textContent = newTitle;
    elements.titleInput.value = newTitle;

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

        let lastSpace = text.lastIndexOf(' ', chunkEnd);
        let lastNewLine = text.lastIndexOf('\n', chunkEnd);
        let splitIndex = chunkEnd;

        if (lastNewLine > currentIndex + (maxLength * 0.7)) {
            splitIndex = lastNewLine + 1;
        } else if (lastSpace > currentIndex + (maxLength * 0.5)) {
            splitIndex = lastSpace + 1;
        }

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

        const processedPrefix = prefix.replace(/{i}/g, index + 1).replace(/{n}/g, chunks.length);
        const processedSuffix = suffix.replace(/{i}/g, index + 1).replace(/{n}/g, chunks.length);
        const fullText = `${processedPrefix}${chunk}${processedSuffix}`;

        clone.querySelector('.chunk-index').textContent = `${index + 1} / ${chunks.length}`;
        clone.querySelector('.chunk-len').textContent = `${fullText.length} chars`;
        clone.querySelector('.chunk-content').textContent = fullText;

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
        settings: { ...state.settings }
    };

    state.history.unshift(newItem);
    loadProject(newId);
    elements.sidebar.classList.remove('open');
    saveAll();
}

function loadProject(id) {
    const project = state.history.find(p => p.id === id);
    if (!project) return; // Should not happen if ID is valid

    state.currentId = project.id;
    state.title = project.title;
    state.text = project.text;
    state.settings = { ...project.settings };

    updateUIValues();
    processText();
    renderHistory();
    saveAll();
}

function updateUIValues() {
    elements.input.value = state.text;
    elements.titleDisplay.textContent = state.title;
    elements.titleInput.value = state.title;
    elements.lenInput.value = state.settings.splitLen;
    elements.prefixInput.value = state.settings.prefix;
    elements.suffixInput.value = state.settings.suffix;
    updateStats();

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
        // Debounce cloud save
        if (currentUser) saveToCloud(state.history[index]);
    } else {
        // Edge case: Current ID not in history?
        // Usually means new project creation race.
    }
}

function deleteHistoryItem(id, e) {
    if (e) e.stopPropagation();
    if (!confirm("Delete this project?")) return;

    state.history = state.history.filter(p => p.id !== id);
    if (currentUser) deleteFromCloud(id);

    if (state.currentId === id) {
        if (state.history.length > 0) {
            loadProject(state.history[0].id);
        } else {
            createNewProject();
        }
    } else {
        renderHistory();
        saveAll();
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
        saveAll();
        renderHistory();
        if (currentUser) saveToCloud(state.history[index]);
    }
}

function renderHistory() {
    elements.historyList.innerHTML = '';

    state.history.forEach(item => {
        const div = document.createElement('div');
        div.className = `history-item ${item.id === state.currentId ? 'active' : ''}`;

        const viewMode = document.createElement('div');
        viewMode.style.display = 'flex';
        viewMode.style.width = '100%';
        viewMode.style.justifyContent = 'space-between';
        viewMode.style.alignItems = 'center';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'history-title';
        titleSpan.textContent = item.title || "Untitled";

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'history-actions';

        const renameBtn = document.createElement('span');
        renameBtn.textContent = '✎';
        renameBtn.className = 'action-icon';
        renameBtn.title = 'Rename';
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

        div.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.closest('.history-confirm-btn')) return;
            loadProject(item.id);
        });

        elements.historyList.appendChild(div);
    });
}

function enterSidebarEditMode(divContainer, item) {
    divContainer.innerHTML = '';
    divContainer.classList.add('editing');

    const input = document.createElement('input');
    input.type = 'text';
    input.value = item.title;
    input.className = 'history-edit-input';
    input.maxLength = 50;

    const confirmBtn = document.createElement('button');
    confirmBtn.innerHTML = '✓';
    confirmBtn.className = 'history-confirm-btn';

    const save = (e) => {
        if (e) e.stopPropagation();
        const newTitle = input.value.trim() || "Untitled";

        if (state.currentId === item.id) {
            state.title = newTitle;
            elements.titleDisplay.textContent = newTitle;
            elements.titleInput.value = newTitle;
        }

        renameHistoryItem(item.id, newTitle);
    };

    confirmBtn.onclick = save;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save(e);
    });
    input.addEventListener('blur', () => {
        setTimeout(() => save(), 150);
    });

    divContainer.appendChild(input);
    divContainer.appendChild(confirmBtn);
    input.focus();
}

function saveAll() {
    saveToLocal();
    // Cloud sync updates handled individually or via debounce logic
}

function saveToLocal() {
    // Uses the dynamic key
    localStorage.setItem(currentStorageKey, JSON.stringify(state));
}

function loadFromLocal(key) {
    // Reset state before load
    state.history = [];
    state.currentId = null;
    state.text = "";
    state.title = "Untitled Project";

    const raw = localStorage.getItem(key);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            state.history = parsed.history || [];
            if (state.history.length > 0) {
                state.currentId = state.history[0].id;
            } else {
                // No history in this bucket
            }
        } catch (e) {
            console.error("Failed to load save", e);
        }
    }
}

// Start
init();
