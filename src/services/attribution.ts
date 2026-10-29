import { User } from 'firebase/auth';

// Who created or changed something; stored as e.g. createdBy, updatedBy, uploadedBy
export interface Attribution {
    uid: string;
    name: string;
}

// Shown publicly, so never fall back to the email address
export const getDisplayName = (user: User): string => user.displayName?.trim() || 'Anonymous boater';

export const attributionFor = (user: User): Attribution => ({ uid: user.uid, name: getDisplayName(user) });

export const formatShortDate = (timestamp: number): string =>
    new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
