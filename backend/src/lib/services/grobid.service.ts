import axios, { AxiosError } from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import { parseGrobidXml } from '../utils/xml.parser';
import { DocumentBlock } from '../types/job.types';


export const processPdfWithGrobid = async (filePath: string): Promise<DocumentBlock[]> => {
  if (!process.env.GROBID_URL) {
    throw new Error('GROBID_URL is not configured');
  }

  const form = new FormData();
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found at path: ${filePath}`);
  }
  form.append('input', fs.createReadStream(filePath));
  form.append('consolidateHeader', '1');
  form.append('consolidateCitations', '1');

  try {
    console.log(`[GrobidService] Sending PDF to GROBID: ${filePath}`);
    const response = await axios.post<string>(process.env.GROBID_URL, form, {
      headers: {
        ...form.getHeaders(),
        'Accept': 'application/xml',
      },
      responseType: 'text',
      timeout: 120000
    });

    console.log(`[GrobidService] GROBID processing successful for ${filePath}. Parsing XML...`);
    const parsedSections = await parseGrobidXml(response.data);
    console.log(`[GrobidService] XML parsing complete for ${filePath}. Found sections: ${Object.keys(parsedSections).join(', ')}`);
    return parsedSections;

  } catch (error: unknown) {
    const axiosError = error as AxiosError;
    console.error(`[GrobidService] Error processing ${filePath}:`, axiosError.message);
    if (axiosError.response) {
      console.error('GROBID Response Status:', axiosError.response.status);
      console.error('GROBID Response Data:', axiosError.response.data);
      if(axiosError.response.status === 400) {
        throw new Error(`GROBID Bad Request (400): Invalid PDF or GROBID parameter? ${axiosError.response.data}`);
      }
      throw new Error(`GROBID request failed with status ${axiosError.response.status}`);
    } else if (axiosError.request) {
      console.error('GROBID No response received:', axiosError.request);
      if ((axiosError as any).code === 'ECONNREFUSED') {
        throw new Error(`GROBID connection refused. Is GROBID running at ${process.env.GROBID_URL}?`);
      }
      throw new Error('GROBID request made but no response received.');
    } else {
      throw new Error(`Error setting up GROBID request: ${axiosError.message}`);
    }
  }
};