import {consoleLoggingMiddleware, errorConsoleLoggingMiddleware, loggingMiddleware} from "./middleware/logging";
import 'dotenv/config'
import express from 'express';
import cors from 'cors';
import {documentRouter} from "@app/routes/document/router";
import {createGrobidWorker} from "@lib/services/queue.service";
import * as console from "node:console";


const app = express();
const port = process.env.PORT || 5000;


app.use(consoleLoggingMiddleware);
app.use(loggingMiddleware);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));


app.use('/api/document', documentRouter())

app.get('/health', (_, res) => {
  res.status(200).json({status: 'ok'});
})

app.use(errorConsoleLoggingMiddleware);

const startServer = async () => {
  try {
    const worker = createGrobidWorker();

    const gracefulShutdown = async (signal: string) => {
      console.log(`Received ${signal}. Shutting down gracefully...`);
      try {
        console.log('Closing worker...');
        await worker?.close();
        console.log('Worker closed.');
        server.close(() => {
          console.log('HTTP server closed.');
          process.exit(0);
        });
      } catch (err) {
        console.error('Error during graceful shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));


    const server = app.listen(port, () => {
      console.log(`Backend server running at http://localhost:${port}`);
      console.log('GROBID Worker is running and listening for jobs.');
    });

  } catch (error) {
    console.error("Failed to start the server or worker:", error);
    process.exit(1);
  }
};
startServer().then(() => console.log("Server started successfully"));

