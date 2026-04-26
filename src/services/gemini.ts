import { GoogleGenAI, Type } from "@google/genai";
import { Incident } from "../types";

let aiClient: GoogleGenAI | null = null;

function getAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment variables.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export const analyzeIncidentImage = async (base64Image: string, incidentType: string) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp", 
      contents: [{
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: "image/jpeg",
            },
          },
          {
            text: `Analyze this image for the following reported incident type: "${incidentType}".`,
          }
        ]
      }],
      config: {
        systemInstruction: `You are an AI Incident Commander performing rapid visual triage.
        
        Strict Operational Rules:
        1. Output MUST be 1-2 lines only.
        2. NO conversational filler (e.g., "I see", "Based on the image").
        3. IF the image matches the incident type ("${incidentType}"), you MUST use these exact phrases:
           - medical: "Image verified: possible medical emergency detected."
           - theft: "Image supports reported theft incident."
           - fire: "Smoke/fire indicators detected in uploaded image."
           - other/unknown: "Image verified: [1-word observation] detected."
        4. IF the image does NOT match the incident type:
           - "Uploaded image does not match the reported incident."
           - OR "Image unclear for this incident type."`,
        temperature: 0.1, // Low temperature for deterministic output
      }
    });
    return response.text;
  } catch (error) {
    console.error("Vision AI Error:", error);
    return "Image analysis failed: connection error.";
  }
};

export const generateIncidentSummary = async (incident: Incident) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: `Generate a concise emergency incident summary for the following:
      Type: ${incident.type}
      Severity: ${incident.severity}
      Description: ${incident.description}
      Location: ${incident.location.address}, Floor: ${incident.location.floor}, Zone: ${incident.location.zone}`,
      config: {
        systemInstruction: "You are an AI Incident Commander. Provide a clear, professional summary for emergency responders. Use Google Maps data to verify the location if possible.",
        tools: [{ googleMaps: {} }]
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating summary.";
  }
};

export const generateResponsePlan = async (incident: Incident) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: `Create a step-by-step emergency response plan for:
      Type: ${incident.type}
      Severity: ${incident.severity}
      Description: ${incident.description}
      Location: ${incident.location.address}
      
      Return the plan strictly as a JSON object with the following structure:
      {
        "steps": [{"action": string, "priority": "immediate" | "secondary" | "follow-up", "assignedTo": string}],
        "evacuationRequired": boolean,
        "evacuationRoute": string,
        "nearbyResources": string[]
      }`,
      config: {
        systemInstruction: "You are an AI Incident Commander. Provide actionable, prioritized steps for staff and security teams. Use Google Maps data to identify nearby emergency resources like hospitals or fire stations. Return ONLY the JSON object.",
        tools: [{ googleMaps: {} }],
      },
    });
    
    const text = response.text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
  } catch (error) {
    console.error("Gemini Error:", error);
    return { steps: [], evacuationRequired: false };
  }
};
