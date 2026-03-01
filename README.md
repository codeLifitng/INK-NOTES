# ✒️ Ink Notes

A free, precise note-taking web app with Apple Pencil & stylus support. Fully client-side — no server, no account needed.

![Ink Notes](https://img.shields.io/badge/Hosted_on-Vercel-black?style=flat-square&logo=vercel)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

## ✨ Features

- **Pressure-sensitive pen** — Works with Apple Pencil, Surface Pen, Wacom, and any stylus
- **Drawing tools** — Pen, Highlighter, Eraser, Line, Rectangle, Ellipse
- **Text tool** — Click anywhere to type, 6 font sizes, inherits selected color
- **12 colors** — Curated palette from ink black to gold
- **7 brush sizes** — Fine to thick strokes
- **Multi-page** — Create unlimited pages with sidebar navigation
- **Grid & Ruled backgrounds** — Toggle graph paper or lined paper
- **Undo/Redo** — Full history with keyboard shortcuts (⌘Z / ⌘⇧Z)
- **Export PNG** — Download any page as an image

## 💾 How Saving Works

| When | What Happens |
|------|-------------|
| **Active session** | Auto-saves to IndexedDB every 5 seconds |
| **Tab switch** | Saves to IndexedDB immediately |
| **2 min inactive** | Auto-downloads a `.json` backup file |
| **Browser close** | Final save to IndexedDB + confirmation prompt |
| **Next visit** | Auto-loads from IndexedDB if cache is intact |
| **Cache cleared** | Upload your `.json` backup via 📂 Restore |
| **Manual save** | Click 💾 Save or press ⌘S anytime |

## 🚀 Deploy to Vercel (Free)

### Option 1: One-Click Deploy

1. Push this project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click **"Add New Project"** → Import your repo
4. Vercel auto-detects Vite — just click **"Deploy"**
5. Done! Your app is live at `your-project.vercel.app`

### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# From the project directory
vercel

# Follow the prompts — it handles everything
```

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
ink-notes/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx          # Full app (drawing, tools, persistence)
│   └── main.jsx         # React entry point
├── index.html           # HTML shell with mobile meta tags
├── package.json
├── vite.config.js
└── README.md
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘Z` / `Ctrl+Z` | Undo |
| `⌘⇧Z` / `Ctrl+Shift+Z` | Redo |
| `⌘S` / `Ctrl+S` | Download backup file |

## 📱 Mobile & Tablet

The app is optimized for touch devices with:
- `touch-action: none` to prevent browser gestures
- `user-scalable=no` to prevent pinch zoom
- `apple-mobile-web-app-capable` for iOS full-screen
- Pressure sensitivity for supported styluses

## License

MIT — Free to use, modify, and share.
