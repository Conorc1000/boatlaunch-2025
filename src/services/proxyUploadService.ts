// Proxy upload service that uploads via backend to avoid CORS issues

export const proxyUploadService = (
    file: File,
    newImgId: string,
    onProgress?: (message: string) => void,
    onSuccess?: (url: string) => void,
    onError?: (error: string) => void
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const fileName = `WebSitePhotos/${newImgId}___Source.jpg`;

        // Create FormData for multipart upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileName', fileName);

        const xhr = new XMLHttpRequest();

        // Use environment-specific backend URL
        const backendUrl = process.env.NODE_ENV === 'production'
            ? '/.netlify/functions'
            : 'http://localhost:3001';

        xhr.open('POST', `${backendUrl}/upload`);

        xhr.onload = function () {
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        const successMsg = 'Image successfully uploaded';
                        onProgress?.(successMsg);
                        onSuccess?.(response.url);
                        resolve(response.url);
                    } else {
                        const errorMsg = response.error || 'Upload failed';
                        onError?.(errorMsg);
                        reject(new Error(errorMsg));
                    }
                } catch (error) {
                    const errorMsg = 'Failed to parse upload response';
                    onError?.(errorMsg);
                    reject(new Error(errorMsg));
                }
            } else {
                try {
                    const errorResponse = JSON.parse(xhr.responseText);
                    const errorMsg = errorResponse.error || `Upload failed with status: ${xhr.status}`;
                    onError?.(errorMsg);
                    reject(new Error(errorMsg));
                } catch (error) {
                    const errorMsg = `Upload failed with status: ${xhr.status}`;
                    onError?.(errorMsg);
                    reject(new Error(errorMsg));
                }
            }
        };

        xhr.onerror = function () {
            const errorMsg = "Network error during upload";
            onError?.(errorMsg);
            reject(new Error(errorMsg));
        };

        xhr.upload.onprogress = function (event) {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                onProgress?.(`Uploading... ${Math.round(percentComplete)}%`);
            }
        };

        xhr.send(formData);
    });
};

export default proxyUploadService;
