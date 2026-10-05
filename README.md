# CollabCanvas: Real-Time Collaborative Infinite Canvas

CollabCanvas is an infinite-canvas collaborative whiteboard and note-taking platform combining the boundless spatial freedom of **Excalidraw** and **Miro** with the full productivity toolset of **Microsoft OneNote**. Multiple users can draw, write rich notes, place shapes, tables, equations, and media simultaneously with zero state collisions.

---

## 🚀 Key Architectural Highlights

- **Conflict-free Replicated Data Types (CRDT via Yjs)**: Granular property maps (`Y.Map<string, Y.Map<any>>`) ensure concurrent edits converge deterministically with zero canvas locking.
- **Dynamic Expanding Quadtree**: Custom spatial index supporting unbounded 2D canvas coordinates with viewport culling (smooth 60 FPS with 10k+ elements).
- **Dual-Layer HTML5 Canvas Engine**:
  - **Base Scene Layer**: Rough.js hand-drawn sketch aesthetic + `perfect-freehand` pressure-sensitive pen & pencil strokes.
  - **Ephemeral Overlay Layer**: Lightweight overlay handling ~20 Hz throttled remote user cursors, selection highlights, and in-progress interactions.
- **MS OneNote Inking & Productivity Tools**:
  - Ballpoint, felt-tip, and pencil inking.
  - Semi-transparent highlighter with `multiply` pigment blending.
  - Stroke and precision point erasers.
  - Ink-to-Shape automatic geometric recognition.
  - Interactive Ruler & Protractor with ink snapping.
  - Freeform Rich Text containers, Miro-style Sticky Notes, tabular grid tables, LaTeX equations, and in-browser Audio recording.
  - OneNote Tags (interactive To-Do checkboxes, Important, Question, Idea) with slide-out Tag Search drawer.
  - Ink Replay player with speed and scrubbing controls.
- **25 MB Resumable Chunked Uploads**: 1 MB part partitioning with SHA-256 deduplication and verification.
- **HTTP Range Streaming**: Audio and video assets stream via `Accept-Ranges: bytes` and `206 Partial Content`.
- **Host Persistence & Docker Deployment**: Snapshot vectors saved directly to `./data/` on the host machine. Single `docker-compose.yml`.

---

## 📁 Repository Structure

```text
collab-canvas/
├── shared/                     # Shared domain models, contracts, and math algorithms
│   ├── src/
│   │   ├── constants.ts        # Chunk sizes, viewport limits, throttles
│   │   ├── types/              # Elements, Viewport, Room, and API types
│   │   ├── indexing/
│   │   │   ├── fractional.ts   # Deterministic fractional z-index ordering
│   │   │   └── quadtree.ts     # Infinite expanding spatial index
│   │   └── geometry/
│   │       ├── bounds.ts       # AABB bounding boxes & lasso point-in-polygon
│   │       ├── ink-to-shape.ts # Geometric feature recognizer
│   │       └── ruler.ts        # Ruler & protractor snapping geometry
├── server/                     # Node.js backend
│   ├── src/
│   │   ├── config.ts           # Environment & directory configuration
│   │   ├── security.ts         # scrypt password hashing & HMAC room tokens
│   │   ├── storage.ts          # YDoc disk persistence, snapshots, & restore
│   │   ├── uploads.ts          # 25 MB chunked upload manager & deduplication
│   │   ├── crdt.ts             # Yjs WebSocket synchronization server
│   │   ├── routes/             # Express API routes (/api/rooms, /api/assets)
│   │   └── server.ts           # Server bootstrap & static asset handler
├── client/                     # React 18 + TypeScript + Vite frontend
│   ├── src/
│   │   ├── engine/             # Camera, Freehand inking, Rough.js renderer
│   │   ├── state/              # Zustand store & CRDT bridge
│   │   ├── components/         # Canvas, OneNote Ribbon, Modals, Overlays
│   │   └── services/           # REST API client & resumable upload client
├── data/                       # Host PC persistent volume mount
├── Dockerfile                  # Multi-stage production container build
└── docker-compose.yml          # Container configuration with ./data mount
```

---

## 🛠️ Getting Started

### 1. Local Development (NPM Workspaces)

```bash
# Install dependencies across all workspaces
npm install

# Run backend and frontend concurrently
npm run dev
```

- Server starts at `http://localhost:8080`
- Client Vite dev server starts at `http://localhost:3000` (proxies `/api` and `/ws` to `8080`)

### 2. Run Tests

```bash
# Run shared and backend unit test suites
npm run test
```

### 3. Production Build & Run

```bash
# Build all workspaces
npm run build

# Start production server (serves client bundle from port 8080)
npm start
```

### 4. Docker Deployment

```bash
# Build and run with Docker Compose
docker compose up -d --build
```

Access the app at: `http://localhost:8080`
Data persists on your host machine under `./data/`.
