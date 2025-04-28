export interface GrobidJobData {
  fileId: string;
  filePath: string;
  originalName: string;
}

export interface DocumentBlock  {
  id: string;
  type: string;
  label: string;
  content: string;
  preview?: string;
  level?: number;
}

export type ProcessingStatus = 'queued' | 'processing' | 'processed' | 'failed';

export interface CachedData {
  status: ProcessingStatus;
  originalName: string;
  blocks?: DocumentBlock[];
  error?: string;
  jobId?: string;
}