'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from 'reaflow';
import dynamic from 'next/dynamic';
import FileTree, { TreeItem } from './components/FileTree';
import FileDetails from './components/FileDetails';

// Zoom/Pan (client-only)
const TransformWrapper = dynamic(
  () => import('react-zoom-pan-pinch').then(m => m.TransformWrapper),
  { ssr: false }
);
const TransformComponent = dynamic(
  () => import('react-zoom-pan-pinch').then(m => m.TransformComponent),
  { ssr: false }
);

type RawGraph = { nodes: any[]; edges: any[] };
const isDirId = (id: string) => id.startsWith('dir:');

// ---------- Helpers ----------
const filename = (p: string) => {
  const parts = String(p).replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
};

// --- BEGIN: width-wrapping / indentation helper ---
type NodeLike = { id: string; text: string; width?: number; height?: number };
type EdgeLike = { id: string; from: string; to: string; type?: string };

const GROUP_NODE_PREFIX = 'group:'; // unique id prefix for synthetic nodes
const MAX_CHILDREN_PER_GROUP = 8;   // tune: smaller = more stagger columns

/**
 * For any parent with too many direct children, insert tiny "group" nodes and
 * route children through them so the layer wraps to additional sub-columns.
 */
function wrapWideLayers(
  nodes: NodeLike[],
  edges: EdgeLike[]
): { nodes: NodeLike[]; edges: EdgeLike[] } {
  const childrenByParent = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type === 'child') {
      const arr = childrenByParent.get(e.from) ?? [];
      arr.push(e.to);
      childrenByParent.set(e.from, arr);
    }
  }

  const newNodes: NodeLike[] = [...nodes];
  const newEdges: EdgeLike[] = edges.filter(e => e.type !== 'child'); // keep non-child edges

  for (const [parentId, kids] of childrenByParent) {
    if (kids.length <= MAX_CHILDREN_PER_GROUP) {
      // keep original child edges as-is
      for (const k of kids) {
        newEdges.push({ id: `${parentId}->${k}`, from: parentId, to: k, type: 'child' });
      }
      continue;
    }

    // Chunk kids into groups
    for (let i = 0; i < kids.length; i += MAX_CHILDREN_PER_GROUP) {
      const chunk = kids.slice(i, i + MAX_CHILDREN_PER_GROUP);
      const gid = `${GROUP_NODE_PREFIX}${parentId}:${i / MAX_CHILDREN_PER_GROUP}`;

      // Tiny, unobtrusive router node
      newNodes.push({ id: gid, text: '…', width: 28, height: 22 });

      // parent -> group
      newEdges.push({ id: `${parentId}->${gid}`, from: parentId, to: gid, type: 'child' });

      // group -> original kids
      for (const k of chunk) {
        newEdges.push({ id: `${gid}->${k}`, from: gid, to: k, type: 'child' });
      }
    }
  }

  return { nodes: newNodes, edges: newEdges };
}
// --- END: width-wrapping / indentation helper ---

export default function Page() {
  // Mount gate to avoid rzp@3.7.0 “Components are not mounted” quirks
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [raw, setRaw] = useState<RawGraph>({ nodes: [], edges: [] });
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [detailsPath, setDetailsPath] = useState<string | null>(null);

  // Last-known layout positions (if you want zoom-to-node later)
  const layoutMapRef = useRef<Map<string, any>>(new Map());

  // Load graph.json
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/graph.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to fetch graph data: ${res.statusText}`);
        setRaw(await res.json());
      } catch (err) {
        console.error('Failed to load graph data:', err);
      }
    })();
  }, []);

  // label -> id
  const labelToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of raw.nodes ?? []) {
      const label = String(n.label ?? '').replace(/\\/g, '/');
      if (label) m.set(label, String(n.id));
    }
    return m;
  }, [raw]);

  // file -> parent dir
  const parentOfFile = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of raw.edges ?? []) {
      if (e.type === 'child' && String(e.to).startsWith('file:') && String(e.from).startsWith('dir:')) {
        map.set(String(e.to), String(e.from));
      }
    }
    return map;
  }, [raw]);

  // Sidebar items
  const treeItems: TreeItem[] = useMemo(() => {
    const items: TreeItem[] = [];
    for (const n of raw.nodes ?? []) {
      const path = String(n.label ?? '').replace(/\\/g, '/');
      if (path) items.push({ path, isDir: String(n.id).startsWith('dir:') });
    }
    return items;
  }, [raw]);

  // Canvas nodes (short labels)
  const allNodes = useMemo(() => {
    return (raw.nodes ?? []).map((n: any) => {
      const isDir = String(n.id).startsWith('dir:');
      const text = isDir ? `📁 ${filename(String(n.label ?? n.id))}`
                         : filename(String(n.label ?? n.id));
      return {
        id: String(n.id),
        text,
        width: Math.min(260, Math.max(140, text.length * 7)),
        height: isDir ? 38 : 46
      };
    });
  }, [raw]);

  // Edges
  const allEdges = useMemo(() => {
    return (raw.edges ?? []).map((e: any, i: number) => ({
      id: `${e.from}->${e.to}:${i}`,
      from: String(e.from),
      to: String(e.to),
      text: e.type,
      type: e.type
    }));
  }, [raw]);

  // Focus logic: folder = subtree; file = parent subtree
  const subtree = useMemo(() => {
    if (!focusedId) return { nodes: allNodes, edges: allEdges };

    const buildSubtree = (root: string) => {
      const childEdges = allEdges.filter(e => e.type === 'child');
      const toChildren = new Map<string, string[]>();
      for (const e of childEdges) {
        const arr = toChildren.get(e.from) ?? [];
        arr.push(e.to);
        toChildren.set(e.from, arr);
      }
      const keep = new Set<string>([root]);
      const q = [root];
      while (q.length) {
        const cur = q.shift()!;
        for (const c of toChildren.get(cur) ?? []) {
          if (!keep.has(c)) { keep.add(c); q.push(c); }
        }
      }
      return {
        nodes: allNodes.filter(n => keep.has(n.id)),
        edges: allEdges.filter(e => keep.has(e.from) && keep.has(e.to))
      };
    };

    if (isDirId(focusedId)) return buildSubtree(focusedId);
    const parent = parentOfFile.get(focusedId);
    return parent ? buildSubtree(parent) : { nodes: allNodes, edges: allEdges };
  }, [focusedId, allNodes, allEdges, parentOfFile]);

  // NEW: wrap very wide layers so huge folders don't get clipped
  const { nodes: wrappedNodes, edges: wrappedEdges } = useMemo(
    () => wrapWideLayers(subtree.nodes as any[], subtree.edges as any[]),
    [subtree.nodes, subtree.edges]
  );

  // Sidebar selection handler
  const handleSelect = (repoRelPath: string, kind: 'dir' | 'file') => {
    const id = labelToId.get(repoRelPath.replace(/\\/g, '/'));
    if (!id) return;
    setFocusedId(id);
    setDetailsPath(kind === 'file' ? repoRelPath : null);
  };

  // Pan/zoom configs (memoized; rzp@3.7.0 doesn’t like prop identity churn)
  const dblClickCfg = useMemo(() => ({ disabled: false, mode: 'zoomIn' as const }), []);
  const wheelCfg    = useMemo(() => ({ step: 0.005, smoothStep: 0.002, activationKeys: [] }), []);
  const panCfg      = useMemo(() => ({ velocityDisabled: true }), []);
  const pinchCfg    = useMemo(() => ({ step: 5 }), []);

  if (!mounted) {
    return <div style={{ height: '100vh', width: '100vw', background: '#0f1115' }} />;
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden', // no page scrollbars; zoom/pan handles navigation
        background: '#0f1115'
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          borderRight: '1px solid #232833',
          background: '#0e1117',
          color: '#e5e7eb',
          overflowY: 'auto'
        }}
      >
        <FileTree items={treeItems} onSelect={handleSelect} />
      </aside>

      {/* Main area (title + graph) */}
      <main style={{ position: 'relative', display: 'grid', gridTemplateRows: '44px 1fr' }}>
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            borderBottom: '1px solid #232833',
            gap: 8,
            background: '#0f1115',
            color: '#e5e7eb'
          }}
        >
          <span style={{ opacity: 0.9 }}>
            {focusedId ? (isDirId(focusedId) ? 'Folder subtree' : 'Focused file view') : 'Full view'}
          </span>
          {(focusedId || detailsPath) && (
            <button
              onClick={() => { setFocusedId(null); setDetailsPath(null); }}
              style={{
                marginLeft: 'auto',
                background: '#1f2937',
                color: '#e5e7eb',
                border: '1px solid #2b3140',
                padding: '6px 10px',
                borderRadius: 8,
                cursor: 'pointer'
              }}
            >
              Clear focus
            </button>
          )}
        </div>

        {/* Graph container (relative for overlay) */}
        <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0f1115' }}>
          <TransformWrapper
            // NiFi-like plane
            minScale={0.15}
            maxScale={2.5}
            initialScale={0.9}
            initialPositionX={0}
            initialPositionY={0}
            centerOnInit={false}
            limitToBounds={false}

            // Gestures
            doubleClick={dblClickCfg}
            wheel={wheelCfg}
            panning={panCfg}
            pinch={pinchCfg}
          >
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%', overflow: 'hidden', background: '#0f1115' }}
              contentStyle={{ width: 'max-content', height: 'max-content' }}
            >
              <Canvas
                key={`c-${focusedId ?? 'all'}-${wrappedNodes.length}-${wrappedEdges.length}`}
                direction="RIGHT"
                nodes={wrappedNodes as any}
                edges={wrappedEdges as any}
                readonly
                animated
                layoutOptions={{
                  'elk.algorithm': 'layered',
                  'elk.direction': 'RIGHT',
                  'elk.edgeRouting': 'SPLINES',
                  'elk.spacing.nodeNode': '28',
                  'elk.layered.spacing.nodeNodeBetweenLayers': '96',
                  'elk.layered.considerModelOrder': 'true'
                }}
                onLayoutChange={(layout: any) => {
                  const pos = new Map<string, any>();
                  layout?.nodes?.forEach((n: any) => pos.set(n.id, n));
                  layoutMapRef.current = pos;
                }}
              />
            </TransformComponent>
          </TransformWrapper>

          {/* File details overlay (no page scroll needed) */}
          {detailsPath && (
            <div>
              <FileDetails path={detailsPath} onClose={() => setDetailsPath(null)} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
