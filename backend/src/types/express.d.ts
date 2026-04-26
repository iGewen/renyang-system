import 'express';

declare module 'express' {
  interface Request {
    user?: {
      id: string;
      username?: string;
      role?: number;
      [key: string]: any;
    };
  }
}
