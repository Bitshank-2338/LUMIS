"use client";

/**
 * AuditForceGraph — exact MiroFish-style D3 SVG force-directed graph.
 *
 * Matches MiroFish GraphPanel.vue:
 *  - SVG with D3 force simulation
 *  - Curved quadratic-bezier edges (multi-edge pairs)
 *  - Node circles with white stroke + color by type
 *  - Text labels offset right of each node
 *  - White-background edge labels (toggleable)
 *  - Click → right-side detail panel
 *  - Zoom + drag
 *  - Dot-grid background
 *  - Bottom-left legend
 *  - Live "updating" badge while audit runs
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import * as d3 from "d3";
import { GraphData, GraphNode, GraphEdge, getAuditGraph } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RefreshCw, Eye, EyeOff, Maximize2, Brain } from "lucide-react";

// ── colour palette — mirrors MiroFish entity type colours ────────────────────
const PALETTE = [
  "#10B981", // ACCEPTED  → emerald
  "#EF4444", // REJECTED  → red
  "#60A5FA", // White     → blue
  "#FB923C", // Black     → orange
  "#34D399", // Asian     → green
  "#FBBF24", // Hispanic  → yellow
  "#A78BFA", // Native    → purple
  "#22D3EE", // Pacific   → cyan
  "#F472B6", // Female    → pink
  "#818CF8", // Other
];

const DECISION_COLOR: Record<string, string> = {
  ACCEPTED: "#10B981",
  REJECTED: "#EF4444",
  PENDING:  "#94A3B8",
};

const RACE_COLOR: Record<string, string> = {
  white:            "#60A5FA",
  black:            "#FB923C",
  asian:            "#34D399",
  hispanic:         "#FBBF24",
  native_american:  "#A78BFA",
  pacific_islander: "#22D3EE",
};

const GENDER_COLOR: Record<string, string> = {
  male:       "#60A5FA",
  female:     "#F472B6",
  non_binary: "#A78BFA",
};

function nodeColor(node: GraphNode, colorBy: string): string {
  const attrs = node.attributes;
  if (colorBy === "decision") {
    const decision = attrs.decision as string || "PENDING";
    return DECISION_COLOR[decision] || "#94A3B8";
  }
  if (colorBy === "race") {
    return RACE_COLOR[attrs.race as string] || "#94A3B8";
  }
  if (colorBy === "gender") {
    return GENDER_COLOR[attrs.gender as string] || "#94A3B8";
  }
  return "#94A3B8";
}

// ── types for D3 simulation ───────────────────────────────────────────────────
type SimNode = GraphNode & d3.SimulationNodeDatum & {
  _color: string;
  _dragStart?: { x: number; y: number };
  _dragging?: boolean;
};

type SimLink = {
  source: SimNode;
  target: SimNode;
  raw: GraphEdge;
  curvature: number;
  pairTotal: number;
  isSelfLoop: boolean;
};

// ── component ─────────────────────────────────────────────────────────────────
interface Props {
  auditId: string;
  isRunning?: boolean;   // show "live updating" badge
  colorBy?: "decision" | "race" | "gender";
  maxNodes?: number;
  height?: number;
}

export function AuditForceGraph({
  auditId,
  isRunning = false,
  colorBy = "decision",
  maxNodes = 300,
  height = 560,
}: Props) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const simRef    = useRef<d3.Simulation<SimNode, SimLink> | null>(null);

  const [graphData, setGraphData]   = useState<GraphData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [selected, setSelected]     = useState<{ type: "node" | "edge"; data: any } | null>(null);
  const [colorMode, setColorMode]   = useState<"decision"|"race"|"gender">(colorBy);

  // ── fetch graph data ────────────────────────────────────────────────────────
  const fetchGraph = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await getAuditGraph(auditId, maxNodes, colorMode);
      setGraphData(data);
    } catch (e: any) {
      // While the audit is still running, the backend may temporarily return 202.
      // Don't surface that as an error — just keep polling.
      if (!silent) setError(e?.message || "Failed to load graph");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [auditId, maxNodes, colorMode]);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  // ── live polling while audit is running ─────────────────────────────────────
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      fetchGraph(true); // silent refresh, no loading flash
    }, 1500);
    return () => clearInterval(id);
  }, [isRunning, fetchGraph]);

  // ── build D3 graph whenever data changes ────────────────────────────────────
  useEffect(() => {
    if (!graphData || !svgRef.current || !wrapRef.current) return;

    const wrap = wrapRef.current;
    const W = wrap.clientWidth || 900;
    const H = height;

    // Stop previous simulation
    if (simRef.current) simRef.current.stop();

    const svg = d3.select(svgRef.current)
      .attr("width", W)
      .attr("height", H)
      .attr("viewBox", `0 0 ${W} ${H}`);

    svg.selectAll("*").remove();

    const nodesRaw = graphData?.nodes ?? [];
    const edgesRaw = graphData?.edges ?? [];
    if (!nodesRaw || nodesRaw.length === 0) return;

    // ── prepare sim nodes ─────────────────────────────────────────────────
    const nodeMap = new Map<string, SimNode>();
    const nodes: SimNode[] = nodesRaw.map(n => {
      const sn: SimNode = {
        ...n,
        _color: nodeColor(n, colorMode),
        x: W / 2 + (Math.random() - 0.5) * 400,
        y: H / 2 + (Math.random() - 0.5) * 300,
      };
      nodeMap.set(n.uuid, sn);
      return sn;
    });

    // ── prepare sim links with curvature ──────────────────────────────────
    const pairCount: Record<string, number> = {};
    const pairIdx:   Record<string, number> = {};
    const selfLoopNodes = new Set<string>();

    (edgesRaw || []).forEach(e => {
      if (e.source_node_uuid === e.target_node_uuid) {
        selfLoopNodes.add(e.source_node_uuid);
        return;
      }
      const key = [e.source_node_uuid, e.target_node_uuid].sort().join("|");
      pairCount[key] = (pairCount[key] || 0) + 1;
    });

    const links: SimLink[] = [];
    const seenSelfLoop = new Set<string>();

    (edgesRaw || []).forEach(e => {
      const src = nodeMap.get(e.source_node_uuid);
      const tgt = nodeMap.get(e.target_node_uuid);
      if (!src || !tgt) return;

      if (e.source_node_uuid === e.target_node_uuid) {
        if (seenSelfLoop.has(e.source_node_uuid)) return;
        seenSelfLoop.add(e.source_node_uuid);
        links.push({ source: src, target: tgt, raw: e, curvature: 0, pairTotal: 1, isSelfLoop: true });
        return;
      }

      const key = [e.source_node_uuid, e.target_node_uuid].sort().join("|");
      const total = pairCount[key] || 1;
      const idx   = pairIdx[key] || 0;
      pairIdx[key] = idx + 1;

      const isReversed = e.source_node_uuid > e.target_node_uuid;
      let curvature = 0;
      if (total > 1) {
        const range = Math.min(1.2, 0.6 + total * 0.15);
        curvature = ((idx / (total - 1)) - 0.5) * range * 2;
        if (isReversed) curvature = -curvature;
      }
      links.push({ source: src, target: tgt, raw: e, curvature, pairTotal: total, isSelfLoop: false });
    });

    // ── D3 force simulation ────────────────────────────────────────────────
    const simulation = d3.forceSimulation<SimNode>(nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(links)
        .id(d => d.uuid)
        .distance(d => 140 + (d.pairTotal - 1) * 50))
      .force("charge", d3.forceManyBody<SimNode>().strength(-350))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collide", d3.forceCollide<SimNode>(36))
      .force("x", d3.forceX(W / 2).strength(0.04))
      .force("y", d3.forceY(H / 2).strength(0.04));

    simRef.current = simulation;

    // ── root group (zoom target) ───────────────────────────────────────────
    const g = svg.append("g");

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .extent([[0,0],[W,H]])
        .scaleExtent([0.08, 6])
        .on("zoom", ev => g.attr("transform", ev.transform))
    );

    // ── helper: link path ─────────────────────────────────────────────────
    function linkPath(d: SimLink): string {
      const sx = (d.source as SimNode).x!, sy = (d.source as SimNode).y!;
      const tx = (d.target as SimNode).x!, ty = (d.target as SimNode).y!;

      if (d.isSelfLoop) {
        const r = 28;
        return `M${sx+8},${sy-4} A${r},${r} 0 1,1 ${sx+8},${sy+4}`;
      }
      if (d.curvature === 0) return `M${sx},${sy} L${tx},${ty}`;

      const dx = tx-sx, dy = ty-sy;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      const ratio = Math.max(35, dist * (0.25 + d.pairTotal * 0.05));
      const cx = (sx+tx)/2 - dy/dist * d.curvature * ratio;
      const cy = (sy+ty)/2 + dx/dist * d.curvature * ratio;
      return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
    }

    function linkMid(d: SimLink): {x:number;y:number} {
      const sx = (d.source as SimNode).x!, sy = (d.source as SimNode).y!;
      const tx = (d.target as SimNode).x!, ty = (d.target as SimNode).y!;
      if (d.isSelfLoop) return { x: sx+70, y: sy };
      if (d.curvature === 0) return { x: (sx+tx)/2, y: (sy+ty)/2 };
      const dx=tx-sx,dy=ty-sy,dist=Math.sqrt(dx*dx+dy*dy)||1;
      const ratio = Math.max(35, dist*(0.25+d.pairTotal*0.05));
      const qx=(sx+tx)/2-dy/dist*d.curvature*ratio;
      const qy=(sy+ty)/2+dx/dist*d.curvature*ratio;
      return { x: 0.25*sx+0.5*qx+0.25*tx, y: 0.25*sy+0.5*qy+0.25*ty };
    }

    // ── edges ─────────────────────────────────────────────────────────────
    const linkGroup = g.append("g").attr("class","links");

    const linkPath_ = linkGroup.selectAll<SVGPathElement, SimLink>("path")
      .data(links).enter().append("path")
      .attr("stroke", "#C0C0C0")
      .attr("stroke-width", 1.5)
      .attr("fill", "none")
      .style("cursor","pointer")
      .on("click", (ev, d) => {
        ev.stopPropagation();
        linkPath_.attr("stroke","#C0C0C0").attr("stroke-width",1.5);
        d3.select(ev.target as SVGPathElement).attr("stroke","#6366F1").attr("stroke-width",3);
        setSelected({ type:"edge", data: {
          name: d.raw.name,
          fact_type: d.raw.fact_type,
          fact: d.raw.fact,
          source_name: d.raw.source_name,
          target_name: d.raw.target_name,
          uuid: d.raw.uuid,
        }});
      });

    // edge label backgrounds
    const linkLabelBg = linkGroup.selectAll<SVGRectElement, SimLink>("rect")
      .data(links).enter().append("rect")
      .attr("fill","rgba(15,23,42,0.85)")
      .attr("rx",3)
      .style("display", showEdgeLabels ? "block" : "none")
      .style("pointer-events","none");

    // edge labels
    const linkLabel = linkGroup.selectAll<SVGTextElement, SimLink>("text")
      .data(links).enter().append("text")
      .text(d => d.raw.name)
      .attr("font-size","8px")
      .attr("fill","#CBD5E1")
      .attr("text-anchor","middle")
      .attr("dominant-baseline","middle")
      .style("font-family","system-ui,sans-serif")
      .style("pointer-events","none")
      .style("display", showEdgeLabels ? "block" : "none");

    // ── nodes ─────────────────────────────────────────────────────────────
    const nodeGroup = g.append("g").attr("class","nodes");

    const isPending = (d: SimNode) =>
      (d.attributes?.decision === "PENDING") || d.attributes?.decision == null;

    const nodeCircle = nodeGroup.selectAll<SVGCircleElement, SimNode>("circle")
      .data(nodes).enter().append("circle")
      .attr("r", d => isPending(d) ? 6 : 10)
      .attr("fill", d => d._color)
      .attr("fill-opacity", d => isPending(d) ? 0.4 : 1)
      .attr("stroke", d => isPending(d) ? "#475569" : "#1E293B")
      .attr("stroke-width", d => isPending(d) ? 1.5 : 2.5)
      .attr("class", d => isPending(d) ? "pulse-pending" : "")
      .style("cursor","pointer")
      .call(
        d3.drag<SVGCircleElement, SimNode>()
          .on("start", (ev, d) => {
            d._dragStart = { x: ev.x, y: ev.y };
            d._dragging  = false;
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (ev, d) => {
            const dx = ev.x - (d._dragStart?.x||ev.x);
            const dy = ev.y - (d._dragStart?.y||ev.y);
            if (!d._dragging && Math.sqrt(dx*dx+dy*dy) > 3) {
              d._dragging = true;
              simulation.alphaTarget(0.3).restart();
            }
            if (d._dragging) { d.fx = ev.x; d.fy = ev.y; }
          })
          .on("end", (ev, d) => {
            if (d._dragging) simulation.alphaTarget(0);
            d.fx = null; d.fy = null; d._dragging = false;
          })
      )
      .on("click", (ev, d) => {
        ev.stopPropagation();
        nodeCircle.attr("stroke","#1E293B").attr("stroke-width",2.5);
        d3.select(ev.target as SVGCircleElement).attr("stroke","#F472B6").attr("stroke-width",4);
        setSelected({ type:"node", data: d });
      })
      .on("mouseenter", (ev, d) => {
        d3.select(ev.target as SVGCircleElement).attr("r", 13);
      })
      .on("mouseleave", (ev, d) => {
        d3.select(ev.target as SVGCircleElement).attr("r", 10);
      });

    // Node labels
    const nodeLabel = nodeGroup.selectAll<SVGTextElement, SimNode>("text")
      .data(nodes).enter().append("text")
      .text(d => d.name.length > 10 ? d.name.slice(0,10)+"…" : d.name)
      .attr("font-size","10px")
      .attr("fill","#CBD5E1")
      .attr("font-weight","500")
      .attr("dx", 14)
      .attr("dy", 4)
      .style("pointer-events","none")
      .style("font-family","system-ui,sans-serif");

    // ── click svg background to deselect ─────────────────────────────────
    svg.on("click", () => {
      nodeCircle.attr("stroke","#1E293B").attr("stroke-width",2.5);
      linkPath_.attr("stroke","#C0C0C0").attr("stroke-width",1.5);
      setSelected(null);
    });

    // ── tick ─────────────────────────────────────────────────────────────
    simulation.on("tick", () => {
      linkPath_.attr("d", linkPath);

      linkLabel.each(function(d) {
        const mid = linkMid(d);
        d3.select(this).attr("x", mid.x).attr("y", mid.y);
      });
      linkLabelBg.each(function(d, i) {
        const mid = linkMid(d);
        const textEl = (linkLabel.nodes() as SVGTextElement[])[i];
        if (!textEl) return;
        try {
          const bb = textEl.getBBox();
          d3.select(this)
            .attr("x", mid.x - bb.width/2 - 4)
            .attr("y", mid.y - bb.height/2 - 2)
            .attr("width",  bb.width + 8)
            .attr("height", bb.height + 4);
        } catch(_) {}
      });

      nodeCircle.attr("cx", d => d.x!).attr("cy", d => d.y!);
      nodeLabel .attr("x",  d => d.x!).attr("y",  d => d.y!);
    });

    // Store refs for toggle
    (svgRef.current as any)._linkLabel   = linkLabel;
    (svgRef.current as any)._linkLabelBg = linkLabelBg;

    return () => { simulation.stop(); };
  }, [graphData, colorMode, height]);

  // ── toggle edge labels without full redraw ────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return;
    const ll  = (svgRef.current as any)._linkLabel;
    const llb = (svgRef.current as any)._linkLabelBg;
    if (ll)  ll.style("display",  showEdgeLabels ? "block" : "none");
    if (llb) llb.style("display", showEdgeLabels ? "block" : "none");
  }, [showEdgeLabels]);

  // ── legend items ──────────────────────────────────────────────────────────
  const legendItems = colorMode === "decision"
    ? [{ color:"#10B981", label:"Accepted" },{ color:"#EF4444", label:"Rejected" },{ color:"#94A3B8", label:"Pending" }]
    : colorMode === "race"
    ? Object.entries(RACE_COLOR).map(([k,v])=>({ color:v, label:k.replace(/_/g," ") }))
    : Object.entries(GENDER_COLOR).map(([k,v])=>({ color:v, label:k.replace(/_/g," ") }));

  const stats = graphData?.stats;

  return (
    <div className="relative flex flex-col gap-3">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1 border border-border/60 rounded-lg p-0.5">
          {(["decision","race","gender"] as const).map(m => (
            <button key={m}
              onClick={() => setColorMode(m)}
              className={cn("px-2.5 py-1.5 rounded-md transition font-medium",
                colorMode===m ? "bg-accent-primary/20 text-accent-glow" : "text-slate-400 hover:text-white"
              )}
            >{m}</button>
          ))}
        </div>
        <button onClick={() => setShowEdgeLabels(v=>!v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:bg-elevated text-slate-400 hover:text-white transition">
          {showEdgeLabels ? <Eye className="w-3.5 h-3.5"/> : <EyeOff className="w-3.5 h-3.5"/>}
          Edge labels
        </button>
        <button onClick={fetchGraph}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:bg-elevated text-slate-400 hover:text-white transition">
          <RefreshCw className="w-3.5 h-3.5"/>
          Refresh
        </button>
        {stats && (
          <div className="ml-auto flex items-center gap-3 text-slate-400 font-mono">
            <span className="text-emerald-400">{stats.accepted} accepted</span>
            <span className="text-red-400">{stats.rejected} rejected</span>
            <span>{stats.total_nodes} nodes · {stats.total_edges} edges</span>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {/* graph canvas */}
        <div
          ref={wrapRef}
          className="relative flex-1 rounded-xl overflow-hidden border border-border/60"
          style={{ height, background:"#0A0F1A",
            backgroundImage:"radial-gradient(rgba(148,163,184,0.12) 1px, transparent 1px)",
            backgroundSize:"24px 24px" }}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-accent-primary/30 border-t-accent-primary animate-spin"/>
                <span className="text-sm text-slate-400">Building agent graph…</span>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          <svg ref={svgRef} className="w-full" style={{height}} />

          {/* live-updating badge (MiroFish style) */}
          {isRunning && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-black/70 backdrop-blur border border-white/10 text-white text-xs font-medium z-20">
              <Brain className="w-4 h-4 text-emerald-400 animate-pulse"/>
              Graph memory updating in real-time…
            </div>
          )}

          {/* legend — bottom left */}
          {!loading && graphData && (
            <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur border border-white/10 rounded-lg px-3 py-2.5 z-10">
              <div className="text-[10px] font-semibold text-pink-400 uppercase tracking-wider mb-2">
                {colorMode === "decision" ? "Decision" : colorMode === "race" ? "Race / Ethnicity" : "Gender"}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 max-w-xs">
                {legendItems.map(item => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: item.color, boxShadow:`0 0 6px ${item.color}` }}/>
                    <span className="text-[11px] text-slate-400 capitalize">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* edge labels toggle (top-right inside graph) */}
          {!loading && graphData && (
            <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur border border-white/10 text-[11px] text-slate-400 z-10">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setShowEdgeLabels(v=>!v)}
                  className={cn("relative w-8 h-4 rounded-full transition",
                    showEdgeLabels ? "bg-purple-600" : "bg-slate-700"
                  )}
                >
                  <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                    showEdgeLabels ? "left-4" : "left-0.5"
                  )}/>
                </div>
                Edge labels
              </label>
            </div>
          )}
        </div>

        {/* detail panel — right (MiroFish style) */}
        {selected && (
          <div className="w-72 flex-shrink-0 rounded-xl border border-border bg-elevated/80 backdrop-blur overflow-hidden flex flex-col" style={{maxHeight:height}}>
            <div className="flex items-center justify-between px-4 py-3 bg-background/60 border-b border-border">
              <span className="font-semibold text-sm">
                {selected.type === "node" ? "Agent Profile" : "Relationship"}
              </span>
              {selected.type === "node" && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: nodeColor(selected.data as GraphNode, colorMode)+"33",
                           color:     nodeColor(selected.data as GraphNode, colorMode) }}>
                  {(selected.data as GraphNode).attributes?.decision || "PENDING"}
                </span>
              )}
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white ml-2">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 text-xs space-y-3">
              {selected.type === "node" ? (
                <NodeDetail node={selected.data as SimNode} colorMode={colorMode}/>
              ) : (
                <EdgeDetail edge={selected.data}/>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Node detail panel ─────────────────────────────────────────────────────────
function NodeDetail({ node, colorMode }: { node: SimNode; colorMode: string }) {
  const attrs = node.attributes || {};
  const decision = attrs.decision as string || "PENDING";
  const color = nodeColor(node, "decision");

  const rows: [string, any][] = [
    ["Name",        node.name],
    ["Decision",    <span style={{color}} className="font-semibold">{decision}</span>],
    ["Score",       typeof attrs.score === "number" ? attrs.score.toFixed(3) : attrs.score],
    ["Ground truth",attrs.ground_truth],
    ["Gender",      attrs.gender],
    ["Race",        attrs.race],
    ["Age",         `${attrs.age} (${attrs.age_group})`],
    ["ZIP",         attrs.zip_code],
    ["Disability",  attrs.disability],
    ["Origin",      attrs.nationality_origin],
  ];

  const featureKeys = Object.keys(attrs).filter(k =>
    !["gender","race","age","age_group","zip_code","disability","nationality_origin","domain","decision","score","ground_truth"].includes(k)
  );

  return (
    <>
      {node.summary && (
        <div className="p-3 rounded-lg bg-background/60 border border-border text-slate-300 leading-relaxed">
          {node.summary}
        </div>
      )}
      <div className="space-y-1.5">
        {rows.map(([label, val]) => val !== undefined && val !== null && val !== "" ? (
          <div key={label} className="flex gap-2">
            <span className="text-slate-500 min-w-[90px]">{label}:</span>
            <span className="text-slate-200 flex-1">{val}</span>
          </div>
        ) : null)}
      </div>
      {featureKeys.length > 0 && (
        <div className="pt-3 border-t border-border">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Domain features</div>
          <div className="space-y-1.5">
            {featureKeys.map(k => (
              <div key={k} className="flex gap-2">
                <span className="text-slate-500 min-w-[90px] capitalize">{k.replace(/_/g," ")}:</span>
                <span className="text-slate-200">{String(attrs[k])}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Edge detail panel ─────────────────────────────────────────────────────────
function EdgeDetail({ edge }: { edge: any }) {
  return (
    <>
      <div className="p-3 rounded-lg bg-background/60 border border-border text-slate-300 font-medium">
        {edge.source_name} → {edge.name} → {edge.target_name}
      </div>
      <div className="space-y-1.5">
        {[["Type", edge.fact_type], ["Label", edge.name], ["Fact", edge.fact]].map(([l,v]) =>
          v ? (
            <div key={l} className="flex gap-2">
              <span className="text-slate-500 min-w-[60px]">{l}:</span>
              <span className="text-slate-200 flex-1">{v}</span>
            </div>
          ) : null
        )}
        <div className="flex gap-2">
          <span className="text-slate-500 min-w-[60px]">UUID:</span>
          <span className="text-slate-500 font-mono text-[10px] break-all">{edge.uuid}</span>
        </div>
      </div>
    </>
  );
}
