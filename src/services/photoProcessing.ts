// Client-side processing done before a photo is uploaded
import exifr from 'exifr';

const THUMB_MAX_SIZE = 640; // Longest edge in px; gallery cells are ~180-300px wide at 2x DPR
const THUMB_QUALITY = 0.8;

// Returns the capture time from EXIF in ms, or undefined if the file has none (e.g. most PNGs)
export const readPhotoTakenAt = async (file: File): Promise<number | undefined> => {
    try {
        const exif = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate']);
        const date: Date | undefined = exif?.DateTimeOriginal || exif?.CreateDate;
        // Ignore unset camera clocks and junk values; keep in sync with scripts/backfill-photo-meta.mjs
        const plausible = date instanceof Date && !isNaN(date.getTime())
            && date.getFullYear() >= 1990 && date.getTime() <= Date.now() + 24 * 60 * 60 * 1000;
        return plausible ? date.getTime() : undefined;
    } catch (error) {
        console.warn('Could not read EXIF data:', error);
        return undefined;
    }
};

// Downscales the photo to a JPEG thumbnail. createImageBitmap applies EXIF orientation by default.
export const createThumbnail = async (file: File): Promise<File> => {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, THUMB_MAX_SIZE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Canvas not supported');
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', THUMB_QUALITY));
    if (!blob) {
        throw new Error('Failed to encode thumbnail');
    }
    return new File([blob], 'thumb.jpg', { type: 'image/jpeg' });
};
