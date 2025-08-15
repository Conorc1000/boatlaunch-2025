// TypeScript version of S3 image fetch service

interface ImageUrl {
    src: string;
    id: string;
}

export const fetchImgsService = (imgIds: string[] | undefined): ImageUrl[] => {
    const prefix = `https://s3-eu-west-1.amazonaws.com/${process.env.REACT_APP_S3_PHOTOS_BUCKET}/WebSitePhotos/`;
    const suffix = "___Source.jpg";

    const getUrls = (imgIds: string[] | undefined): ImageUrl[] => {
        console.log("imgIds", imgIds);

        if (!imgIds || imgIds.length === 0) {
            return [];
        }

        const urls = imgIds.map((imgId) => ({
            src: prefix + imgId + suffix,
            id: imgId
        }));

        return urls;
    };

    return getUrls(imgIds);
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
