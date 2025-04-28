
export interface DocumentBlock {
  id: string;
  type: string;
  label: string;
  content: string;
  preview?: string;
  level?: number;
}


export type DocumentStatus =
  'idle'
  | 'uploading'
  | 'polling_status'
  | 'processing'
  | 'ready_to_ask'
  | 'asking_llm'
  | 'failed'
  | 'processed';
