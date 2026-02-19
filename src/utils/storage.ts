import { CanvasNode } from "@/types";

const STORAGE_KEY = "asmemo-frames";

export function loadFrames(): CanvasNode[] {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    try {
        return JSON.parse(stored);
    } catch (e) {
        console.error("Failed to parse nodes from storage", e);
        return [];
    }
}

export function saveFrames(nodes: CanvasNode[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
}
