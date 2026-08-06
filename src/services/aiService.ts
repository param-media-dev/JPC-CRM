import { GoogleGenAI, Type } from '@google/genai';
import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';

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

const extractTextFromDOCX = async (base64: string): Promise<string> => {
  try {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
    return result.value.trim();
  } catch (error) {
    console.error("DOCX Extraction error:", error);
    return "";
  }
};

const extractTextFromTXT = (base64: string): string => {
  try {
    return window.atob(base64).trim();
  } catch (error) {
    console.error("TXT Extraction error:", error);
    return "";
  }
};

export async function parseResume(fileBase64: string, mimeType: string): Promise<ParsedCandidate | null> {
  try {
    let textToParse = "";

    if (mimeType === 'application/pdf') {
      textToParse = await extractTextFromPDF(fileBase64);
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'application/msword') {
      textToParse = await extractTextFromDOCX(fileBase64);
    } else if (mimeType === 'text/plain') {
      textToParse = extractTextFromTXT(fileBase64);
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Switch to lite tier for fastest performance
    
    // If we extracted text, send text directly. Otherwise, send the document blob as fallback.
    const parts: any[] = [];
    if (textToParse.length > 50) {
      parts.push({ text: `Extract candidate information from this resume text:\n\n${textToParse}` });
    } else if (mimeType !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && mimeType !== 'application/msword') {
      parts.push({
        inlineData: {
          data: fileBase64,
          mimeType: mimeType,
        },
      });
      parts.push({ text: "Extract candidate information from this resume document." });
    } else {
       // If it's a docx but text parsing failed or is too short, we must return null early because Gemini doesn't support DOCX inline data.
       return null;
    }

    parts.push({ text: "Return the data in JSON format following the provided schema. If a field is not found, return an empty string." });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
