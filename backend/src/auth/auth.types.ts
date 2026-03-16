import type { JWTPayload } from 'jose';
import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  token: string;
  claims: JWTPayload;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}
