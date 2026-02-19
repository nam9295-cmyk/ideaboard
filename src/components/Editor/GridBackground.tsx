export default function GridBackground() {
    return (
        <div className="absolute inset-0 pointer-events-none z-0">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="1" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-pattern)" />
            </svg>
        </div>
    );
}
