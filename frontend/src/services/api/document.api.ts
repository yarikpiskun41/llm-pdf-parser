import axios, { AxiosResponse } from 'axios';
import {AskResponse, StatusResponse, UploadResponse} from "../../types/api.types.ts";


const API_URL = `${import.meta.env.VITE_API_URL}/document`;

const apiClient = axios.create({
  baseURL: API_URL,
});

export const uploadPdf = async (file: File): Promise<AxiosResponse<UploadResponse>> => {
  const formData = new FormData();
  formData.append('pdfFile', file);

  return apiClient.post<UploadResponse>('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const checkStatus = async (fileId: string): Promise<AxiosResponse<StatusResponse>> => {
  return apiClient.get<StatusResponse>(`/status/${fileId}`);
};


export const askLlm = async (fileId: string, prompt: string, selectedBlockIds: string[]): Promise<AxiosResponse<AskResponse>> => {
  return apiClient.post<AskResponse>('/ask', { // Надсилаємо selectedBlockIds
    fileId,
    prompt,
    selectedBlockIds,
  });
};
