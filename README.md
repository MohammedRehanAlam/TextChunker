# ⚡ TextChunker

A powerful, aesthetic, and privacy-focused web application designed to split long text into smaller, manageable chunks. Ideal for preparing prompts for AI models, social media posts, or messaging platforms with character limits.

## ✨ Features

### 🚀 Core Functionality
*   **Smart Text Splitting**: Automatically splits text by paragraphs, sentences, or words to ensure clean breaks.
*   **Customizable Length**: Choose from presets (500, 1000, 2000, 5000) or set a precise custom character limit.
*   **Prefix & Suffix Support**: Automatically add text to the start and end of every chunk (e.g., "[Part 1/5]", "...continued").

### 💾 Smart Persistence
*   **Auto-Save**: Every keystroke is saved instantly to your local browser storage. Never lose your work.
*   **Auto-Rename**: Projects are automatically named based on their content (e.g., "Meeting Notes...") so you can find them easily.
*   **Smart Session Start**: Reloading the page intelligently starts a new project if you were working, or reopens your last empty project to keep things clean.
*   **Sidebar History**: Access all your previous split projects from the collapsible sidebar.
*   **Cloud Sync (New!)**: Log in with Google to sync your projects across devices.

### 🎨 Modern UI/UX
*   **Glassmorphism Design**: Sleek, dark-themed interface with translucent glass effects.
*   **Responsive Layout**: Fully optimized for both desktop and mobile devices.
*   **Integrated Stats**: Real-time character and word counts that stay visible while you type.
*   **One-Click Copy**: Copy generated chunks instantly with a visual confirmation.

## 🛠️ Technology Stack
*   **HTML5**: Semantic structure.
*   **CSS3**: Advanced styling with Flexbox, Grid, Variables, and Media Queries.
*   **JavaScript (ES6+)**: Pure, dependency-free logic for state management and DOM manipulation.
*   **Local Storage**: Client-side data persistence for offline use.
*   **Firebase**: Google Auth and Firestore for cloud synchronization.

## 🚀 Getting Started

1.  **Clone or Download** the repository.
2.  **Open `index.html`** in any modern web browser.
3.  **Start Typing**: Paste your text into the main input box.
4.  **Configure**: Set your split length and add optional prefixes/suffixes.
5.  **Copy**: Click the "Copy" button on any generated chunk.

## 🔐 Privacy
TextChunker is **Local-First**. Your data is stored on your device by default. Signing in via Google enables **Cloud Sync**, securely storing your projects in your private Firestore database for cross-device access.

---
*Built with simplicity and efficiency in mind.*
