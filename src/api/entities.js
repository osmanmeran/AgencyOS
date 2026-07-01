import { db } from '@/lib/DbContext';


export const Query = db.entities.Query;

// auth sdk:
export const User = db.auth;