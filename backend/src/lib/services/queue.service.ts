import {Queue, Worker, Job} from 'bullmq';
import IORedis from 'ioredis';
import path from 'path';
import fs from 'fs';
import {GrobidJobData, CachedData, ProcessingStatus} from '../types/job.types';
import {processPdfWithGrobid} from './grobid.service';

export const GROBID_QUEUE_NAME = 'grobid-processing';

const redisConnectionOpts = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  db: Number(process.env.REDIS_DB),
  maxRetriesPerRequest: null,
}

const processedDataCache: Record<string, CachedData> = {};
const CACHE_TTL_MS = 60 * 60 * 1000;


export const getCache = (fileId: string): CachedData | undefined => {
  return processedDataCache[fileId];
};

export const setCache = (fileId: string, data: CachedData) => {
  processedDataCache[fileId] = data;
  setTimeout(() => {
    if (processedDataCache[fileId]?.status !== 'processing') {
      console.log(`[Cache] Cleaning up cache for ${fileId}`);
      delete processedDataCache[fileId];
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
      const filePath = path.join(uploadsDir, fileId);
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) console.error(`[Cache Cleanup] Error deleting file ${filePath}:`, err);
          else console.log(`[Cache Cleanup] Deleted file ${filePath}`);
        });
      }
    }
  }, CACHE_TTL_MS);
};

export const updateCacheStatus = (fileId: string, status: ProcessingStatus, jobId?: string, error?: string) => {
  const existingData = processedDataCache[fileId] || {originalName: fileId};
  setCache(fileId, {...existingData, status, jobId: jobId || existingData.jobId, error: error || undefined});
};


const redisClient = new IORedis(redisConnectionOpts);

redisClient.on('error', err => console.error('[Redis] Connection Error:', err));
redisClient.on('connect', () => console.log('[Redis] Connected successfully.'));


export const grobidQueue = new Queue<GrobidJobData>(GROBID_QUEUE_NAME, {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {count: 1000},
    removeOnFail: {count: 5000}
  }
});

export const addGrobidJob = async (data: GrobidJobData): Promise<Job<GrobidJobData>> => {
  console.log(`[Queue] Adding job for file ${data.fileId} ${data.originalName}`);
  const job = await grobidQueue.add(`process-${data.fileId}`, data);
  setCache(data.fileId, {
    status: 'queued',
    originalName: data.originalName,
    jobId: job.id
  });
  return job;
};


const processJob = async (job: Job<GrobidJobData>) => {
  const {fileId, filePath, originalName} = job.data;
  console.log(`[Worker] Processing job ${job.id} for file: ${fileId} (${originalName})`);

  updateCacheStatus(fileId, 'processing', job.id);

  try {
    const blocks = await processPdfWithGrobid(filePath);

    setCache(fileId, {
      status: 'processed',
      originalName: originalName,
      blocks: blocks,
      jobId: job.id
    });
    console.log(`[Worker] Successfully processed job ${job.id} for ${fileId}. Found ${blocks.length} blocks.`);

    try {
      fs.unlinkSync(filePath);
      console.log(`[Worker] Deleted temporary file: ${filePath}`);
    } catch (unlinkErr: any) {
      console.error(`[Worker] Error deleting temporary file ${filePath} after processing:`, unlinkErr.message);
    }


  } catch (error: any) {
    console.error(`[Worker] Job ${job.id} failed for ${fileId}:`, error.message);
    updateCacheStatus(fileId, 'failed', job.id, error.message || 'Unknown processing error');
    throw error;
  }
};

export const createGrobidWorker = () => {
  console.log('[Worker] Initializing GROBID worker...');
  const worker = new Worker<GrobidJobData>(GROBID_QUEUE_NAME, processJob, {
    connection: redisClient,
    concurrency: 2
  });

  worker.on('completed', (job: Job) => {
    console.log(`[Worker] Job ${job.id} (file: ${job.data.fileId}) completed.`);
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`[Worker] Job ${job?.id} (file: ${job?.data?.fileId}) failed after attempts. Error: ${err.message}`);
    if (job?.data.filePath && fs.existsSync(job.data.filePath)) {
      fs.unlink(job.data.filePath, (unlinkErr) => {
        if (unlinkErr) console.error(`[Worker Failure Cleanup] Error deleting file ${job.data.filePath}:`, unlinkErr);
        else console.log(`[Worker Failure Cleanup] Deleted file ${job.data.filePath}`);
      });
    }
  });

  worker.on('error', err => {
    console.error('[Worker] General worker error:', err);
  });


  console.log('[Worker] GROBID worker initialized and listening for jobs.');
  return worker;
};