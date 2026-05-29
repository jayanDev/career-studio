import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { role = "Professional", industry = "Tech", style = "professional" } = await req.json();
    
    // Programmatic SVG generator instead of paid API
    const colors = {
      professional: ["#0f172a", "#334155", "#0ea5e9"],
      creative: ["#4c1d95", "#d946ef", "#f43f5e"],
      minimalist: ["#f8fafc", "#e2e8f0", "#94a3b8"],
      bold: ["#1e1b4b", "#c2410c", "#fcd34d"]
    };
    
    const palette = colors[style as keyof typeof colors] || colors.professional;
    const bg = palette[0];
    const accent1 = palette[1];
    const accent2 = palette[2];

    const svg = `
      <svg width="1584" height="396" viewBox="0 0 1584 396" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${bg}" />
            <stop offset="100%" stop-color="${accent1}" />
          </linearGradient>
          <pattern id="pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="${accent2}" opacity="0.3" />
          </pattern>
        </defs>
        <rect width="1584" height="396" fill="url(#grad)" />
        <rect width="1584" height="396" fill="url(#pattern)" />
        
        <circle cx="200" cy="198" r="150" fill="${accent2}" opacity="0.1" />
        <circle cx="1384" cy="50" r="250" fill="${accent2}" opacity="0.1" />
        
        <text x="792" y="198" font-family="system-ui, sans-serif" font-size="64" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">
          ${role.toUpperCase()}
        </text>
        <text x="792" y="270" font-family="system-ui, sans-serif" font-size="32" fill="${accent2}" text-anchor="middle">
          ${industry} Specialist
        </text>
      </svg>
    `;

    const base64Svg = Buffer.from(svg.trim()).toString('base64');
    const imageUrl = `data:image/svg+xml;base64,${base64Svg}`;

    return NextResponse.json({ imageUrl });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate banner" },
      { status: 500 }
    );
  }
}
