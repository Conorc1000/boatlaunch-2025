import { User } from 'firebase/auth';

// Keep in sync with the admin checks in database.rules.json, which are what actually protect the data
export const ADMIN_EMAIL = 'conorc1000@gmail.com';

export const isAdmin = (user: User | null | undefined): boolean =>
    !!user && user.emailVerified && user.email?.toLowerCase() === ADMIN_EMAIL;
