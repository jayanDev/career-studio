"use client";

import { useMemo } from "react";
import { ReactFlow, Background, Controls, type Node, type Edge, BackgroundVariant } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

function domainColor(domain: string) {
  const colors: Record<string, string> = {
    Tech: "#0f766e",
    Business: "#2563eb",
    Finance: "#4f46e5",
    Creative: "#be123c",
    Service: "#b45309",
    General: "#525252",
  };
  return colors[domain] ?? colors.General;
}

type ConstellationItem = {
  id: string;
  role: string;
  domain: string;
  match: number;
  x: number;
  y: number;
  summary: string;
};

export function ConstellationFlow({ items }: { items: ConstellationItem[] }) {
  const { nodes, edges } = useMemo(() => {
    const centerNodeId = "identity";
    const ns: Node[] = [
      {
        id: centerNodeId,
        position: { x: 400, y: 300 }, // center of the viewport approx
        data: { label: "Your Identity" },
        style: {
          borderRadius: "50%",
          width: 80,
          height: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid #5eead4",
          backgroundColor: "rgba(45, 212, 191, 0.2)",
          color: "#f0fdfa",
          fontSize: "12px",
          fontWeight: "bold",
          textAlign: "center",
        },
      },
    ];

    const es: Edge[] = [];

    items.forEach((item) => {
      // Map percentage x/y (0-100) to viewport coordinates (800x600 space)
      const px = (item.x / 100) * 800;
      const py = (item.y / 100) * 600;
      const size = 60 + item.match / 2;

      ns.push({
        id: item.id,
        position: { x: px - size / 2, y: py - size / 2 },
        data: { label: item.role },
        style: {
          borderRadius: "50%",
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: domainColor(item.domain),
          color: "white",
          border: "1px solid rgba(255,255,255,0.2)",
          fontSize: "10px",
          textAlign: "center",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          padding: "8px",
        },
      });

      es.push({
        id: `edge-${centerNodeId}-${item.id}`,
        source: centerNodeId,
        target: item.id,
        style: { stroke: domainColor(item.domain), strokeOpacity: 0.5, strokeWidth: item.match > 80 ? 2 : 1 },
        animated: true,
      });
    });

    return { nodes: ns, edges: es };
  }, [items]);

  return (
    <div style={{ width: "100%", height: "500px" }} className="bg-neutral-950 rounded-lg overflow-hidden">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#333" />
        <Controls className="bg-white text-black" />
      </ReactFlow>
    </div>
  );
}
