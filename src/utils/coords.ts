export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export function worldToScreen(
    world: Rect,
    pan: Point,
    zoom: number
): Rect {
    return {
        x: world.x * zoom + pan.x,
        y: world.y * zoom + pan.y,
        width: world.width * zoom,
        height: world.height * zoom,
    };
}

export function screenToWorld(
    screen: Point,
    pan: Point,
    zoom: number
): Point {
    return {
        x: (screen.x - pan.x) / zoom,
        y: (screen.y - pan.y) / zoom,
    };
}
