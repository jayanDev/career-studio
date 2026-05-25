"use server";

export interface SpellCheckMatch {
  message: string;
  shortMessage: string;
  replacements: { value: string }[];
  offset: number;
  length: number;
  context: {
    text: string;
    offset: number;
    length: number;
  };
}

export async function checkSpellingAction(text: string): Promise<SpellCheckMatch[]> {
  try {
    const response = await fetch("https://api.languagetoolplus.com/v2/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        text,
        language: "en-US",
      }),
    });

    if (!response.ok) {
      throw new Error(`LanguageTool API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.matches || [];
  } catch (error) {
    console.error("Spell check failed:", error);
    return [];
  }
}
