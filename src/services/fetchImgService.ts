// TypeScript version of S3 image fetch service
import { ref, get } from 'firebase/database';
import { database } from '../firebase';

export interface ImageUrl {
    src: string;
    id: string;
    thumbSrc?: string;
    takenAt?: number; // From the photo's EXIF capture date
    addedAt?: number; // Upload time encoded in the image ID
}

// Per-image metadata stored at photoMeta/{imageId}
export interface PhotoMeta {
    takenAt?: number;
    thumb?: boolean;
}

const bucketName = 'boatlaunchphotos'; // Match the actual S3 bucket name
const region = 'eu-west-1';
const prefix = `https://${bucketName}.s3.${region}.amazonaws.com/WebSitePhotos/`;
export const SOURCE_SUFFIX = '___Source.jpg';
export const THUMB_SUFFIX = '___Thumb.jpg';

// IDs from the old app ("New1452362240408") and this one ("slipway_<id>_<ms>_<rand>")
// embed the upload time in ms; legacy numeric IDs carry no date
export const getImageIdTimestamp = (imgId: string): number | undefined => {
    const match = imgId.match(/^New(\d{13})$/) || imgId.match(/_(\d{13})_[a-z0-9]+$/);
    return match ? parseInt(match[1], 10) : undefined;
};

// Legacy IDs are stored in Firebase as numbers (e.g. 530), and arrays can contain null holes
const normalizeImgIds = (imgIds: unknown[] | undefined): string[] =>
    (imgIds || []).filter((imgId) => imgId != null && imgId !== '').map(String);

export const fetchImgsService = (rawImgIds: unknown[] | undefined, meta: Record<string, PhotoMeta> = {}): ImageUrl[] => {
    const imgIds = normalizeImgIds(rawImgIds);

    return imgIds.map((imgId) => ({
        src: prefix + imgId + SOURCE_SUFFIX,
        id: imgId,
        thumbSrc: meta[imgId]?.thumb ? prefix + imgId + THUMB_SUFFIX : undefined,
        takenAt: meta[imgId]?.takenAt,
        addedAt: getImageIdTimestamp(imgId)
    }));
};

// Loads photoMeta for each image before building URLs, so the gallery requests thumbnails
// from the start. Entries are read individually because numeric IDs as keys would make
// Firebase coerce a parent read into a sparse array.
export const loadImgsWithMeta = async (rawImgIds: unknown[] | undefined): Promise<ImageUrl[]> => {
    const imgIds = normalizeImgIds(rawImgIds);
    if (imgIds.length === 0) {
        return [];
    }

    const entries = await Promise.all(imgIds.map(async (imgId) => {
        try {
            const snapshot = await get(ref(database, `photoMeta/${imgId}`));
            return [imgId, (snapshot.val() || {}) as PhotoMeta] as const;
        } catch (error) {
            console.warn('Failed to load photo metadata', imgId, error);
            return [imgId, {} as PhotoMeta] as const;
        }
    }));

    return fetchImgsService(imgIds, Object.fromEntries(entries));
};

export const formatPhotoDate = (image: ImageUrl): string | undefined => {
    if (image.takenAt) {
        return `Taken ${new Date(image.takenAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (image.addedAt) {
        return `Added ${new Date(image.addedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
    }
    return undefined;
};

// Helper function to generate unique image ID for new uploads
export const generateImageId = (slipwayId: string): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `slipway_${slipwayId}_${timestamp}_${random}`;
};

// Helper function to validate image file
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: 'Please select a valid image file (JPEG, PNG, or WebP)'
        };
    }

    if (file.size > maxSize) {
        return {
            valid: false,
            error: 'Image file size must be less than 10MB'
        };
    }

    return { valid: true };
};

export default fetchImgsService;
