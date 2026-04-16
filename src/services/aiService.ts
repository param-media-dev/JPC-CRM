import { GoogleGenAI, Type } from '@google/genai';

export interface ParsedCandidate {
  full_name: string;
  phone: string;
  email: string;
  job_interest: string;
  location: string;
  education: string;
  degree: string;
  university: string;
  graduation_year: string;
  experience_years: string;
  current_company: string;
  current_designation: string;
  skills: string;
  linkedin_url: string;
  notes: string;
}

export async function parseResume(fileBase64: string, mimeType: string): Promise<ParsedCandidate | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              data: fileBase64,
              mimeType: mimeType,
            },
          },
          {
            text: "Extract candidate information from this resume. Return the data in JSON format following the provided schema. If a field is not found, return an empty string.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            full_name: { type: Type.STRING },
            phone: { type: Type.STRING },
            email: { type: Type.STRING },
            job_interest: { type: Type.STRING },
            location: { type: Type.STRING },
            education: { type: Type.STRING },
            degree: { type: Type.STRING },
            university: { type: Type.STRING },
            graduation_year: { type: Type.STRING },
            experience_years: { type: Type.STRING },
            current_company: { type: Type.STRING },
            current_designation: { type: Type.STRING },
            skills: { type: Type.STRING },
            linkedin_url: { type: Type.STRING },
            notes: { type: Type.STRING },
          }
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text.trim()) as ParsedCandidate;
    } else {
      throw new Error('No response from AI');
    }
  } catch (error: any) {
    console.error("Error parsing resume:", error);
    throw new Error(`Failed to parse resume: ${error.message || error}`);
  }
}
