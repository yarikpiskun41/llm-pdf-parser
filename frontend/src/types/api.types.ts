import {DocumentBlock} from "./document.types.ts";

export interface UploadResponse {
  message: string;
  fileId: string;
  jobId: string;
}

export interface StatusResponse {
  status: 'queued' | 'processing' | 'processed' | 'failed';
  originalName: string;
  blocks?: DocumentBlock[];
  error?: string;
  message?: string;
}
export interface AskResponse {
  response: string;
}
