import {
  GoogleGenAI,
} from "@google/genai";
import * as console from "node:console";

if (!process.env.GEMINI_API_KEY) {
  console.error("[GeminiService] Error: GEMINI_API_KEY is not configured or is default.");
}

const genAI = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY || "",});

export const generateContentWithGemini = async (prompt: string, contextSections: Record<string, string>): Promise<string> => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API Key is missing or invalid. Please check configuration.");
  }

  let combinedContext = "Context from the provided document sections:\n---\n";
  if (Object.keys(contextSections).length > 0) {
    for (const [sectionName, content] of Object.entries(contextSections)) {
      const maxSectionLength = 30000;
      const truncatedContent = content.length > maxSectionLength
        ? content.substring(0, maxSectionLength) + "... (truncated)"
        : content;
      combinedContext += `Section: "${sectionName}"\n${truncatedContent}\n---\n`;
    }
  } else {
    combinedContext = "No specific sections provided as context.\n---\n";
  }
  const fullPrompt = `${combinedContext}\nUser Prompt: ${prompt}`;

  console.log("[GeminiService] Sending prompt to Gemini:", fullPrompt);


  try {
    const response = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: fullPrompt,
    });

    if (!response || !response.candidates || response.candidates.length === 0 || !response.text) {
      const blockReason = response?.promptFeedback?.blockReason;
      const safetyRatings = response?.promptFeedback?.safetyRatings;
      console.error("[GeminiService] Gemini response was blocked or empty.");
      console.error("Block Reason:", blockReason);
      console.error("Safety Ratings:", JSON.stringify(safetyRatings, null, 2));
      let errorMessage = `Gemini response was blocked or empty.`;
      if (blockReason) {
        errorMessage += ` Reason: ${blockReason}.`;
      }
      if (safetyRatings && safetyRatings.length > 0) {
        const blockedCategories = safetyRatings.filter(r => r.blocked).map(r => r.category).join(', ');
        if (blockedCategories) {
          errorMessage += ` Blocked categories: ${blockedCategories}.`;
        }
      }
      throw new Error(errorMessage);
    }

    const text = response.text;
    console.log("[GeminiService] Received response from Gemini.");
    return text;
  } catch (error: any) {
    console.error("[GeminiService] Error generating content:", error);
    if (error?.message.includes('API key not valid') || error.message.includes('invalid api key')) {
      throw new Error("Invalid Gemini API Key. Please check your .env configuration.");
    }
    if (error?.message.includes('quota')) {
      throw new Error("Gemini API quota exceeded. Please check your usage limits.");
    }
    if (error?.message.includes('location not supported')) {
      throw new Error("The specified model or feature may not be available in your region.");
    }
    throw new Error(`Failed to get response from Gemini: ${error.message}`);
  }
};