// @ts-nocheck
import ELK from 'elkjs/lib/elk.bundled.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgElement(name: string, attributes: Record<string, string | number> = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function truncate(value: string, length: number) {
  if (!value || value.length <= length) {
    return value || '';
  }
  return `${value.slice(0, length - 1)}…`;
}

function edgePath(section: any) {
  const points = [section.startPoint, ...(section.bendPoints || []), section.endPoint];
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function midpoint(section: any) {
  const points = [section.startPoint, ...(section.bendPoints || []), section.endPoint];
  const index = Math.floor((points.length - 1) / 2);
  const start = points[index];
  const end = points[index + 1] || start;
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function portSides(data: any) {
  const ranks = new Map(data.nodes.map((node: any) => [node.key, node.rank]));
  const portNodes = new Map();
  for (const node of data.nodes) {
    for (const port of node.ports) {
      portNodes.set(port.id, node.key);
    }
  }
  const sides = new Map();
  for (const edge of data.edges) {
    const sourceRanks = edge.sources.map((port: string) => ranks.get(portNodes.get(port)) ?? 1);
    const targetRanks = edge.targets.map((port: string) => ranks.get(portNodes.get(port)) ?? 1);
    const sourceRank = sourceRanks.reduce((sum: number, rank: number) => sum + rank, 0) / sourceRanks.length;
    const targetRank = targetRanks.reduce((sum: number, rank: number) => sum + rank, 0) / targetRanks.length;
    for (const port of edge.sources) {
      sides.set(port, sourceRank <= targetRank ? 'EAST' : 'WEST');
    }
    for (const port of edge.targets) {
      sides.set(port, sourceRank <= targetRank ? 'WEST' : 'EAST');
    }
  }
  return sides;
}

function buildElkGraph(data: any) {
  const sides = portSides(data);
  return {
    id: 'wiring-root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': '110',
      'elk.spacing.nodeNode': '60',
      'elk.spacing.edgeEdge': '14',
      'elk.spacing.edgeNode': '24',
      'elk.spacing.edgeLabel': '12',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.semiInteractive': 'true',
      'elk.layered.mergeEdges': 'false',
      'elk.layered.unnecessaryBendpoints': 'true',
      'elk.layered.edgeLabels.sideSelection': 'SMART',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.padding': '[top=32,left=32,bottom=32,right=32]',
    },
    children: data.nodes.map((node: any) => ({
      id: node.key,
      width: node.width,
      height: node.height,
      ports: node.ports.map((port: any) => ({
        id: port.id,
        width: 8,
        height: 8,
        layoutOptions: {
          'elk.port.side': sides.get(port.id) || 'EAST',
        },
      })),
      layoutOptions: {
        'elk.portConstraints': 'FIXED_SIDE',
        'elk.layered.layering.layerConstraint': node.external ? 'FIRST' : 'NONE',
      },
    })),
    edges: data.edges.map((edge: any) => ({
      id: edge.id,
      sources: edge.sources,
      targets: edge.targets,
      labels: edge.label
        ? [
            {
              text: edge.label,
              width: Math.min(260, Math.max(60, edge.label.length * 6)),
              height: 15,
            },
          ]
        : [],
    })),
  };
}

function renderNode(svg: SVGElement, node: any, source: any) {
  if (!source) {
    return;
  }
  const group = svgElement('g', { class: `wiring-node${source.external ? ' external' : ''}` });
  const link = svgElement('a', { href: source.url || '#' });
  const rect = svgElement('rect', {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rx: 4,
  });
  link.appendChild(rect);

  const title = svgElement('text', { class: 'wiring-node-title', x: node.x + 14, y: node.y + 22 });
  title.textContent = truncate(source.title, 34);
  link.appendChild(title);

  const subtitle = svgElement('text', { class: 'wiring-node-subtitle', x: node.x + 14, y: node.y + 40 });
  subtitle.textContent = truncate(source.subtitle, 38);
  link.appendChild(subtitle);

  const rank = svgElement('text', { class: 'wiring-node-rank', x: node.x + node.width - 12, y: node.y + 22 });
  rank.textContent = source.rank_label;
  link.appendChild(rank);
  group.appendChild(link);

  const portsById = new Map(source.ports.map((port: any) => [port.id, port]));
  for (const port of node.ports || []) {
    const sourcePort = portsById.get(port.id);
    const portX = node.x + port.x + port.width / 2;
    const portY = node.y + port.y + port.height / 2;
    const textAnchor = portX < node.x + node.width / 2 ? 'start' : 'end';
    const textX = textAnchor === 'start' ? node.x + 16 : node.x + node.width - 16;
    const portLink = svgElement('a', { href: sourcePort?.url || source.url || '#' });
    portLink.appendChild(svgElement('circle', { class: 'wiring-port', cx: portX, cy: portY, r: 4 }));
    const label = svgElement('text', {
      class: 'wiring-port-text',
      x: textX,
      y: portY + 3,
      'text-anchor': textAnchor,
    });
    label.textContent = truncate(sourcePort?.label || '', 30);
    portLink.appendChild(label);
    group.appendChild(portLink);
  }

  svg.appendChild(group);
}

function renderEdge(svg: SVGElement, edge: any, source: any) {
  if (!source) {
    return;
  }
  for (const section of edge.sections || []) {
    const path = edgePath(section);
    const link = svgElement('a', { href: source.url || '#' });
    link.appendChild(svgElement('path', { class: 'wiring-link-hit', d: path }));
    link.appendChild(svgElement('path', { class: 'wiring-link', d: path, stroke: source.color || '#a23c3c' }));
    const title = svgElement('title');
    title.textContent = `${source.label || 'Cable'}: ${source.source_label} → ${source.target_label}`;
    link.appendChild(title);
    svg.appendChild(link);
  }

  const label = edge.labels?.[0];
  const section = edge.sections?.[0];
  if (label || section) {
    const labelPoint = label && Number.isFinite(label.x) ? label : midpoint(section);
    const text = svgElement('text', {
      class: 'wiring-link-label',
      x: labelPoint.x,
      y: labelPoint.y - 5,
    });
    text.textContent = truncate(source.label || `${source.source_label} → ${source.target_label}`, 42);
    svg.appendChild(text);
  }
}

function renderDiagram(container: HTMLElement, data: any, layout: any) {
  const nodesById = new Map(data.nodes.map((node: any) => [node.key, node]));
  const edgesById = new Map(data.edges.map((edge: any) => [edge.id, edge]));
  const width = Math.ceil((layout.width || 960) + 64);
  const height = Math.ceil((layout.height || 520) + 64);
  const scopeTitle = container.dataset.scopeTitle || 'Wiring Diagram';

  const svg = svgElement('svg', {
    class: 'wiring-diagram',
    xmlns: SVG_NS,
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': scopeTitle,
  }) as SVGElement;

  const style = svgElement('style');
  style.textContent = `
    .wiring-diagram { min-width: 1100px; width: 100%; height: auto; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .wiring-page { fill: #fbfbfc; }
    .wiring-node rect { fill: #ffffff; stroke: #8a96a8; stroke-width: 1.2; }
    .wiring-node.external rect { fill: #f8fafc; stroke-dasharray: 5 4; }
    .wiring-node-title { fill: #162033; font-size: 13px; font-weight: 700; }
    .wiring-node-subtitle, .wiring-node-rank { fill: #526071; font-size: 10px; }
    .wiring-node-rank { text-anchor: end; }
    .wiring-port { fill: #ffffff; stroke: #7a2d2d; stroke-width: 1.4; }
    .wiring-port-text { fill: #334155; font-size: 9px; }
    .wiring-link { fill: none; stroke-width: 1.8; stroke-linejoin: round; stroke-linecap: round; }
    .wiring-link-hit { fill: none; stroke: transparent; stroke-width: 14; }
    .wiring-link-label { fill: #7a2d2d; font-size: 10px; paint-order: stroke; stroke: #fbfbfc; stroke-width: 4px; }
  `;
  svg.appendChild(style);
  svg.appendChild(svgElement('rect', { class: 'wiring-page', x: 0, y: 0, width, height }));

  for (const edge of layout.edges || []) {
    renderEdge(svg, edge, edgesById.get(edge.id));
  }
  for (const node of layout.children || []) {
    renderNode(svg, node, nodesById.get(node.id));
  }

  container.replaceChildren(svg);
}

async function initWiringDiagram() {
  const container = document.getElementById('wiring-diagram');
  const script = document.getElementById('wiring-diagram-data');
  if (!container || !script?.textContent) {
    return;
  }

  const data = JSON.parse(script.textContent);
  const elk = new ELK();
  try {
    const layout = await elk.layout(buildElkGraph(data));
    renderDiagram(container, data, layout);
  } catch (error) {
    container.replaceChildren();
    const message = document.createElement('div');
    message.className = 'alert alert-danger m-3';
    message.textContent = `Unable to lay out wiring diagram: ${error instanceof Error ? error.message : error}`;
    container.appendChild(message);
  }
}

document.addEventListener('DOMContentLoaded', initWiringDiagram);
