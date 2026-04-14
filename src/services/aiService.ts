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
    const response = await fetch('/api/parse-resume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileBase64, mimeType }),
    });

    if (!response.ok) {
      throw new Error(`Failed to parse resume: ${response.statusText}`);
    }

    return await response.json() as ParsedCandidate;
  } catch (error) {
    console.error("Error parsing resume:", error);
    return null;
  }
}
