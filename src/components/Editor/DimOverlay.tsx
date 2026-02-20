"use client";

import { useEditor } from "@/context/EditorContext";
import { useCanvasParams } from "@/hooks/useCanvasParams";
import { useMemo } from "react";

export default function DimOverlay() {
    const { nodes, dimOutsideFrames } = useEditor();
    const frames = nodes.filter(n => n.type === 'FRAME');
    const { zoom, pan } = useCanvasParams();

    // If dimming is disabled or no frames exist, don't render anything
    if (!dimOutsideFrames) return null;

    // We'll use a large enough rectangle to cover the canvas, 
    // and cut out holes for the frames using a mask or fill-rule.
    // SVG with fill-rule="evenodd" is the easiest way.
    // 
    // Outer rect: The whole viewport (or a very large virtual area)
    // Holes: Each frame's rectangle
    // 
    // Since our frames are in World Coordinates, and we want to draw in Screen Coordinates (or transformed world coords),
    // it's easier to just draw everything in World Coordinates and apply the same transform as the grid?
    // Actually, drawing in World Coordinates is best because we can just use frame.x/y directly.

    // However, the "Outer Rect" needs to be infinite. 
    // We can simulate infinite by making it huge relative to the current view.
    // Or, we can use screen coordinates and just render the viewport rect as the outer one.
    // Let's use World Coordinates with a "Huge" outer rect that covers everything we can see.
    // 
    // But `Canvas.tsx` has two layers: 
    // 1. Grid (Transformed)
    // 2. Frames (Screen Coords)
    // 
    // If we put DimOverlay in the Transformed layer, we can just use frame coordinates directly.
    // The "infinite" outer rect just needs to be large enough to cover the visible area.
    // 
    // Let's assume a massive number for the outer rect, like -100000 to 100000.

    const infinity = 1000000;
    const outerRectPath = `M ${-infinity} ${-infinity} L ${infinity} ${-infinity} L ${infinity} ${infinity} L ${-infinity} ${infinity} Z`;

    const holesPath = frames.map(frame => {
        const { x, y, width, height } = frame;
        return `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`;
    }).join(" ");

    return (
        <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
        >
            <svg
                className="overflow-visible"
                width="1"
                height="1"
                style={{ overflow: 'visible' }}
            >
                <path
                    d={`${outerRectPath} ${holesPath}`}
                    fill="black"
                    fillOpacity="0.35"
                    fillRule="evenodd"
                />
            </svg>
        </div>
    );
}
