import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`Error ${statusCode}: ${message}`, {
    url: req.url,
    method: req.method,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });

  res.status(statusCode).json({
    error: {
      message,
      status: statusCode,
      timestamp: new Date().toISOString(),
      path: req.url
    }
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: {
      message: `Route ${req.originalUrl} not found`,
      status: 404,
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    }
  });
};
