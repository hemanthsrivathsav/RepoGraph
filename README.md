# RepoGraph

RepoGraph is a monorepo tool for **visualizing your codebase as an interactive dependency graph**.  
It helps you explore project folders, files, and relationships — similar to **Apache NiFi’s flow canvas** — right inside a web UI.

---

## Installation

Use [pnpm](https://pnpm.io/) to install all dependencies and set up the project.

```bash
# Clone the repo
git clone https://github.com/yourusername/repograph.git
cd repograph

# Install all workspace dependencies
pnpm install
```

---

## Usage

### Step 1 — Build all packages
```bash
pnpm -w build
```

### Step 2 — Generate the graph JSON
Run the CLI to analyze your codebase and output `graph.json`.

```bash
# Windows
pnpm -F cli start --repo D:\sample-pipeline --out D:\grph-new\packages\web\public\graph.json

# macOS/Linux
pnpm -F cli start --repo <path-to-sample-pipeline> --out ./packages/web/public/graph.json
```

### Step 3 — Start the web viewer
```bash
pnpm -F web dev
```

Then open your browser at [http://localhost:3000](http://localhost:3000).

---

## Features

- 📁 **File Tree Sidebar** – Browse and select folders or files  
- 🧠 **Interactive Graph** – Zoom, pan, and explore file relationships visually  
- 🧩 **Folder Focus** – Click a folder to see its subtree  
- 🪶 **File Details Panel** – Opens an overlay for file info and (future) LLM-based descriptions  
- ⚡ **NiFi-like Canvas** – Smooth zooming and panning experience with `react-zoom-pan-pinch`  

---

## Example

```bash
# Build analyzer and web packages
pnpm -w build

# Generate the graph data from your repo
pnpm -F cli start --repo D:\projects\my-app --out D:\grph-new\packages\web\public\graph.json

# Run the visualizer
pnpm -F web dev
```

---

## Configuration

You can adjust layout and zoom behavior in  
`packages/web/app/page.tsx`.

```ts
// Layout options
layoutOptions={{
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'SPLINES',
  'elk.spacing.nodeNode': '28',
  'elk.layered.spacing.nodeNodeBetweenLayers': '96',
}}

// Zoom and pan settings
minScale={0.15}
maxScale={2.5}
initialScale={0.9}
limitToBounds={false}
wheel={{ step: 0.005, smoothStep: 0.002 }}
```

Large folders are automatically wrapped into sub-columns to prevent clipping.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ENOENT: scandir ...` | Make sure the repo path is correct and absolute. |
| Webpack cache warnings | Safe to ignore during development. |
| Graph clipped or cut off | Zoom out or lower `MAX_CHILDREN_PER_GROUP` in layout config. |
| Graph not updating | Re-run the CLI to regenerate `graph.json` and refresh the page. |
|`pnpm: command not found`| Install pnpm globally using `npm install -g pnpm`.|
|`EACCES: permission denied during npm install -g pnpm`| Use `sudo npm install -g pnpm` and then try running `pnpm install` again.|

---

## Contributing

Pull requests are welcome!  
For major changes, please open an issue first to discuss what you’d like to improve.

Make sure to test your changes in both:
- the **CLI analyzer**
- the **web graph viewer**

and update relevant documentation if needed.
