import {consoleLoggingMiddleware, errorConsoleLoggingMiddleware, loggingMiddleware} from "./middleware/logging";
import 'dotenv/config'
import express, {Request, Response} from 'express';
import cors from 'cors';


const app = express();
const port = process.env.PORT || 5000;


app.use(consoleLoggingMiddleware);
app.use(loggingMiddleware);
app.use(cors());
app.use(express.json());
app.use(errorConsoleLoggingMiddleware);


app.get('/health', (req, res) => {
  res.status(200).json({status: 'ok'});
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
})