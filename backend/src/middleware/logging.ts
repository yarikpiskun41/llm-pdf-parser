import fs from 'fs';
import morgan from 'morgan';
import {NextFunction, Request, Response} from 'express';
import {blue, cyan, yellow, red, magenta, green, gray} from 'colorette';

const logStream = fs.createWriteStream('requests.log', {flags: 'a'});

const loggingMiddleware = morgan('combined', {
  stream: logStream,
  skip: (req: Request, res: Response) => res.statusCode < 400
});

type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | string;

const getColoredMethod = (method: HTTPMethod): string => {
  const paddedMethod = method.padEnd(7);
  switch (method) {
    case 'GET':
      return blue(paddedMethod);
    case 'POST':
      return cyan(paddedMethod);
    case 'PUT':
      return yellow(paddedMethod);
    case 'DELETE':
      return red(paddedMethod);
    case 'PATCH':
      return magenta(paddedMethod);
    default:
      return paddedMethod;
  }
};

const getColoredStatus = (statusCode: number): string => {
  if (statusCode >= 200 && statusCode < 300) return green(statusCode.toString());
  if (statusCode >= 300 && statusCode < 400) return yellow(statusCode.toString());
  if (statusCode >= 400) return red(statusCode.toString());
  return statusCode.toString();
};

const consoleLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const {method, originalUrl} = req;

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const timestamp = new Date().toISOString();

    console.log(
      gray(timestamp) +
      ' ' +
      getColoredMethod(method) +
      gray(originalUrl) +
      ' ' +
      getColoredStatus(res.statusCode) +
      ' ' +
      magenta(`${duration}ms`)
    );
  });

  res.on('error', (error: Error) => {
    console.error(
      red('Response error:') +
      ' ' +
      gray(new Date().toISOString()) +
      ' ' +
      getColoredMethod(method) +
      gray(originalUrl) +
      ' ' +
      red(`Error: ${error.message}`)
    );
  });

  next();
};

const errorConsoleLoggingMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const timestamp = new Date().toISOString();
  const statusCode = res.statusCode >= 400 ? res.statusCode : 500;

  console.error(
    red('ERROR') +
    ' ' +
    gray(timestamp) +
    ' ' +
    getColoredMethod(req.method) +
    gray(req.originalUrl) +
    ' ' +
    red(statusCode.toString()) +
    ' ' +
    red(`Error: ${error.message}`) +
    (process.env.NODE_ENV === 'development' ? '\n' + gray(error.stack || '') : '')
  );

  next(error);
};
export {loggingMiddleware, consoleLoggingMiddleware, errorConsoleLoggingMiddleware};
