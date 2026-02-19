import { useState, useRef, useEffect, useCallback } from 'react';
import { useEditor } from '@/context/EditorContext';

interface Pan {
    x: number;
    y: number;
}

export function useCanvasParams() {
    const { zoom, setZoom, pan, setPan } = useEditor();
    const [isPanning, setIsPanning] = useState(false);
    const [isSpacePressed, setIsSpacePressed] = useState(false);

    const lastMousePos = useRef<Pan>({ x: 0, y: 0 });

    // Handle Space key press for panning mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
                setIsSpacePressed(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setIsSpacePressed(false);
                setIsPanning(false); // Stop panning if space is released
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // handleWheel removed as Canvas.tsx implements its own non-passive listener

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        // Pan if Space is pressed or Middle Click (button 1)
        if (isSpacePressed || e.button === 1) {
            e.preventDefault();
            setIsPanning(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
        }
    }, [isSpacePressed]);

    // We use a global effect for mouse move/up to handle dragging outside canvas
    useEffect(() => {
        if (!isPanning) return;

        const handleGlobalMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;

            setPan((prevPan) => ({
                x: prevPan.x + dx,
                y: prevPan.y + dy,
            }));

            lastMousePos.current = { x: e.clientX, y: e.clientY };
        };

        const handleGlobalMouseUp = () => {
            setIsPanning(false);
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [isPanning, setPan]);


    return {
        zoom,
        setZoom,
        pan,
        setPan,
        isPanning,
        isSpacePressed,
        handleMouseDown,
        // We don't expose mouseMove/Up directly for the div if we use global listeners, 
        // but useful to have local handlers for initial interaction
        handleWrapperMouseDown: handleMouseDown,
    };
}
