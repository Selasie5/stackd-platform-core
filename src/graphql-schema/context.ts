import type { Request, Response } from 'express';
import type { SessionData } from '@/auth/types';

export interface GraphQLContext {
  req: Request;
  res: Response;
  session: SessionData | null;
}
