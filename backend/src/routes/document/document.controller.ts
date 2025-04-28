import  {Request, Response, NextFunction} from 'express';
import fs from 'fs';

import {generateContentWithGemini} from '@lib/services/gemini.service';
import {addGrobidJob, getCache, updateCacheStatus} from '@lib/services/queue.service';

import {GrobidJobData, CachedData} from '@lib/types/job.types';


const uploadFile = async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({message: 'No PDF file uploaded.'});
    return
  }

  const {filename: fileId, path: filePath, originalname: originalName} = req.file as Express.Multer.File;

  try {
    const jobData: GrobidJobData = {fileId, filePath, originalName};
    const job = await addGrobidJob(jobData);

    res.status(202).json({
      message: 'File received and queued for processing.',
      fileId: fileId,
      jobId: job.id
    });
    return

  } catch (error) {
    console.error(`[API /upload] Error queuing file ${fileId}:`, error);
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error(`[API /upload] Error deleting temporary file ${filePath}:`, e);
      return
    }
  }
}

const checkFileStatus = (req: Request, res: Response) => {
  const { fileId } = req.params;
  if (!fileId) {
    res.status(400).json({ message: 'Missing fileId parameter.' });
    return;
  }

  try {
    const cachedData = getCache(fileId);

    if (!cachedData) {
      res.status(404).json({ message: 'File status not found. Invalid fileId or expired.' });
      return;
    }


    const responseData: Partial<CachedData> & { message?: string } = {
      status: cachedData.status,
      originalName: cachedData.originalName
    };

    if (cachedData.status === 'processed') {
      responseData.blocks = cachedData.blocks || [];
      responseData.message = "Processing complete. Ready to visualize and ask.";
    } else if (cachedData.status === 'failed') {
      responseData.error = cachedData.error;
      responseData.message = "Processing failed.";
    } else if (cachedData.status === 'processing') {
      responseData.message = "File is currently being processed by GROBID.";
    } else if (cachedData.status === 'queued') {
      responseData.message = "File is waiting in the queue for processing.";
    }

    res.json(responseData);

  } catch (error: any) {
    console.error(`[API /status] Error checking status for ${fileId}:`, error);
    return;
  }
}

const chatAsk = async (req: Request, res: Response, next: NextFunction) => {
  const { fileId, prompt, selectedBlockIds } = req.body as { fileId: string; prompt: string; selectedBlockIds: string[] };

  if (!fileId || !prompt || !selectedBlockIds || !Array.isArray(selectedBlockIds)) {
    res.status(400).json({ message: 'Missing required fields: fileId, prompt, selectedBlockIds (array).' });
    return;
  }

  try {
    const cachedData = getCache(fileId);

    if (!cachedData) {
      res.status(404).json({ message: 'File data not found. Invalid fileId or expired.' });
      return;
    }

    if (cachedData.status !== 'processed') {
      res.status(400).json({
        message: `File processing not complete. Current status: ${cachedData.status}.`,
        status: cachedData.status,
        error: cachedData.error
      });
      return;
    }

    if (!cachedData.blocks || cachedData.blocks.length === 0) {
      console.error(`[API /ask] Inconsistency: File ${fileId} is processed but has no blocks data.`);
      updateCacheStatus(fileId, 'failed', cachedData.jobId, 'Internal error: Missing blocks data after processing.');
      res.status(500).json({ message: 'Internal server error: Processed data is inconsistent or empty.' });
      return;
    }

    const contextForLlm: Record<string, string> = {};
    let includedContentLength = 0;
    const MAX_CONTEXT_LENGTH = 100000;

    const blocksMap = new Map(cachedData.blocks.map(block => [block.id, block]));

    selectedBlockIds.forEach(blockId => {
      const block = blocksMap.get(blockId);

      if (block) {
        if (includedContentLength + block.content.length < MAX_CONTEXT_LENGTH) {
          const contextKey = `${block.type}: ${block.label}`.substring(0, 100);
          contextForLlm[contextKey] = block.content;
          includedContentLength += block.content.length;
        } else {
          console.warn(`[API /ask] Skipping block ${block.id} ('${block.label}') for ${fileId} due to context length limit.`);
        }
      } else {
        console.warn(`[API /ask] Selected block ID "${blockId}" not found in cached data for ${fileId}`);
      }
    });

    if (Object.keys(contextForLlm).length === 0 && selectedBlockIds.length > 0) {
      console.warn(`[API /ask] None of the selected block IDs [${selectedBlockIds.join(', ')}] were found or included for ${fileId}. Sending prompt without specific document context.`);
      res.status(400).json({ message: 'None of the selected blocks could be found or included in the context.' });
      return;
    }

    console.log(`[API /ask] Generating response for prompt: "${prompt.substring(0, 50)}..." using ${Object.keys(contextForLlm).length} selected blocks for file ${fileId}`);
    const llmResponse = await generateContentWithGemini(prompt, contextForLlm);

    res.json({ response: llmResponse });

  } catch (error: any) {
    console.error('[API /ask] Error processing request:', error);
    next(error);
  }
}

export const documentController = {
  uploadFile,
  checkFileStatus,
  chatAsk
}