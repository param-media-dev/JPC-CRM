import { GoogleGenAI, Type } from '@google/genai';
import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

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

const extractTextFromPDF = async (base64: string): Promise<string> => {
  try {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    let text = '';
    // Only parse the first 5 pages to save time/tokens if it's super long
    const numPages = Math.min(pdf.numPages, 5); 
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      text += strings.join(' ') + '\n';
    }
    return text.trim();
  } catch (error) {
    console.error("PDF Extraction error:", error);
    return "";
  }
};

export async function parseResume(fileBase64: string, mimeType: string): Promise<ParsedCandidate | null> {
  try {
    let textToParse = "";

    // If it's a PDF, extract text directly to make it incredibly fast
    if (mimeType === 'application/pdf') {
      textToParse = await extractTextFromPDF(fileBase64);
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Switch to lite tier for fastest performance
    
    // If we extracted text, send text directly. Otherwise, send the document blob as fallback.
    const parts: any[] = [];
    if (textToParse.length > 50) {
      parts.push({ text: `Extract candidate information from this resume text:\n\n${textToParse}` });
    } else {
      parts.push({
        inlineData: {
          data: fileBase64,
          mimeType: mimeType,
        },
      });
      parts.push({ text: "Extract candidate information from this resume document." });
    }

    parts.push({ text: "Return the data in JSON format following the provided schema. If a field is not found, return an empty string." });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-preview",
      contents: { parts },
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
