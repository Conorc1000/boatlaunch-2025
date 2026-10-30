import { User } from 'firebase/auth';
import { ref, serverTimestamp, update } from 'firebase/database';
import { database } from '../firebase';
import { attributionFor } from './attribution';

// "Deleting" a photo only takes it off the slipway. The S3 file and photoMeta stay, and archivedPhotos/{imgId}
// records where it came from so an admin can put it back (scripts/restore-photo.mjs).
// Returns the slipway's remaining image IDs.
export const archivePhoto = async (slipwayId: string, imgs: unknown[], imgId: string, user: User): Promise<string[]> => {
    const ids = imgs.filter((id) => id != null && id !== '').map(String);
    const remaining = ids.filter((id) => id !== imgId);
    const archivedBy = attributionFor(user);

    // One write so the photo is never removed without its archive record
    await update(ref(database), {
        [`slipwayDetails/${slipwayId}/imgs`]: remaining,
        [`slipwayDetails/${slipwayId}/updatedBy`]: archivedBy,
        [`slipwayDetails/${slipwayId}/updatedAt`]: serverTimestamp(),
        [`archivedPhotos/${imgId}`]: {
            slipwayId,
            position: ids.indexOf(imgId),
            // The log is admin-only, so it can hold the email that public attribution leaves out
            archivedBy: { ...archivedBy, ...(user.email ? { email: user.email } : {}) },
            archivedAt: serverTimestamp()
        }
    });

    return remaining;
};
