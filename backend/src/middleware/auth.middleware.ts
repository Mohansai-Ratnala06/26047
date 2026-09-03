import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../types';

const getJwtSecret = () => process.env.JWT_SECRET || 'dev-secret';

export const protect = (req: Request, res: Response, next: NextFunction): void => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    const response: ApiResponse = { success: false, message: 'Not authorized, no token' };
    res.status(401).json(response);
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    (req as any).user = decoded;
    next();
  } catch (error) {
    const response: ApiResponse = { success: false, message: 'Not authorized, token failed' };
    res.status(401).json(response);
  }
};
