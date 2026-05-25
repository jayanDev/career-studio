import { NextResponse } from "next/server";

// Simple mock for a LinkedIn Banner generator
// In a real application, this would call Replicate, Midjourney, or DALL-E APIs
export async function POST(req: Request) {
  try {
    const { role, industry, style } = await req.json();
    
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Return a Picsum placeholder that matches the dimensions of a LinkedIn banner (1584x396)
    // We add a random seed based on the role to ensure idempotency for the same role
    const seed = encodeURIComponent(role + industry + style);
    const imageUrl = `https://picsum.photos/seed/${seed}/1584/396`;

    return NextResponse.json({ imageUrl });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate banner" },
      { status: 500 }
    );
  }
}
