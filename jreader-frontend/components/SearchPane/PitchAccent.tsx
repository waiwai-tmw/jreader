import type { PitchAccentEntry, PitchAccentEntryList } from "@/types/backend-types";

// Helper function to determine if a mora is high pitch
function isMoraPitchHigh(position: number, downstepPosition: number): boolean {
    if (downstepPosition === 0) {
        // Heiban pattern: first mora is low, rest are high
        return position > 0;
    } else if (downstepPosition === 1) {
        // Atamadaka pattern: first mora is high, rest are low
        return position === 0;
    } else {
        // Other patterns: starts low, goes high, then drops after downstep
        return position > 0 && position < downstepPosition;
    }
}

function PitchAccentGraph({ reading, position, moraCount }: PitchAccentEntry) {
    const DOT_RADIUS = 3;
    const INNER_DOT_RADIUS = 1;
    const SPACING = 20;
    const HEIGHT = 30;
    const HIGH_Y = 8;
    const LOW_Y = 22;
    
    const PADDING = 10;
    const WIDTH = (moraCount + 1) * SPACING + PADDING;

    // Generate main path points (excluding last segment)
    const pathPoints = Array.from({ length: moraCount }).map((_, i) => {
        const x = (i + 1) * SPACING;
        const y = isMoraPitchHigh(i, position) ? HIGH_Y : LOW_Y;
        return `${x} ${y}`;
    });

    // Create separate paths for solid and dotted lines
    const mainPathD = `M${pathPoints.join(' L')}`;
    
    // Get the Y positions for the last mora and final marker
    const lastMoraY = isMoraPitchHigh(moraCount - 1, position) ? HIGH_Y : LOW_Y;
    const finalY = position === 0 ? HIGH_Y : LOW_Y;
    const dottedPathD = `M${moraCount * SPACING} ${lastMoraY} L${(moraCount + 1) * SPACING} ${finalY}`;

    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="pronunciation-graph"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            style={{ width: `${WIDTH}px`, height: `${HEIGHT}px` }}
        >
            {/* Main solid line */}
            <path
                className="stroke-current text-blue-500"
                strokeWidth="1"
                fill="none"
                d={mainPathD}
            />
            
            {/* Dotted line to final marker */}
            <path
                className="stroke-current text-blue-500"
                strokeWidth="1"
                fill="none"
                strokeDasharray="2 2"
                d={dottedPathD}
            />

            {Array.from({ length: moraCount }).map((_, i) => {
                const cx = SPACING * (i + 1);
                const isHigh = isMoraPitchHigh(i, position);
                const cy = isHigh ? HIGH_Y : LOW_Y;

                if (i === position - 1 && position !== 0) {
                    // Position before the drop (circle with inner dot)
                    return (
                        <g key={i}>
                            <circle
                                cx={cx}
                                cy={cy}
                                r={DOT_RADIUS}
                                className="stroke-current text-blue-500 fill-white dark:fill-gray-900"
                                strokeWidth="1"
                            />
                            <circle
                                cx={cx}
                                cy={cy}
                                r={INNER_DOT_RADIUS}
                                className="fill-current text-blue-500"
                            />
                        </g>
                    );
                } else {
                    // Regular mora (filled circle)
                    return (
                        <circle
                            key={i}
                            cx={cx}
                            cy={cy}
                            r={DOT_RADIUS}
                            className="fill-current text-blue-500"
                        />
                    );
                }
            })}

            {/* Final triangle marker - now with stroke instead of fill */}
            <path
                className="stroke-current text-blue-500"
                strokeWidth="1"
                fill="none"
                d={`M${(moraCount + 1) * SPACING - 4} ${finalY - 4} 
                    L${(moraCount + 1) * SPACING + 4} ${finalY - 4} 
                    L${(moraCount + 1) * SPACING} ${finalY + 4} Z`}
            />
        </svg>
    );
}

export function PitchAccentGraphs({ result }: { result: PitchAccentEntryList }) {
    return (
        <div className="pitch-accent-graphs flex flex-wrap gap-3">
            {result.entries.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                    <PitchAccentGraph 
                        reading={entry.reading}
                        position={entry.position}
                        moraCount={entry.moraCount}
                    />
                    <span className="text-xs text-muted-foreground">
                        [{entry.position}]
                    </span>
                </div>
            ))}
        </div>
    );
}