// Direct S3 upload service using presigned URLs to avoid binary corruption

export const proxyUploadService = (
    file: File,
    newImgId: string,
    onProgress?: (message: string) => void,
    onSuccess?: (url: string) => void,
    onError?: (error: string) => void
): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        try {
            const fileName = `WebSitePhotos/${newImgId}___Source.jpg`;
            
            // Use environment-specific backend URL
            const backendUrl = process.env.NODE_ENV === 'production'
                ? '/.netlify/functions'
                : 'http://localhost:8888/.netlify/functions';

            onProgress?.('Getting S3 upload URL...');

            // Step 1: Get presigned URL from sign_s3 function
            const signResponse = await fetch(`${backendUrl}/sign_s3?file_name=${encodeURIComponent(fileName)}&file_type=${encodeURIComponent(file.type)}`);
            
            if (!signResponse.ok) {
                const errorData = await signResponse.json();
                throw new Error(errorData.error || 'Failed to get upload URL');
            }

            const signData = await signResponse.json();
            const { signed_request, url } = signData;

            onProgress?.('Uploading directly to S3...');

            // Step 2: Upload directly to S3 using presigned URL
            const uploadXhr = new XMLHttpRequest();
            
            uploadXhr.open('PUT', signed_request);
            uploadXhr.setRequestHeader('Content-Type', file.type);
            uploadXhr.setRequestHeader('x-amz-acl', 'public-read');

            uploadXhr.onload = function () {
                if (uploadXhr.status === 200) {
                    const successMsg = 'Image successfully uploaded to S3';
                    onProgress?.(successMsg);
                    onSuccess?.(url);
                    resolve(url);
                } else {
                    const errorMsg = `S3 upload failed with status: ${uploadXhr.status}`;
                    onError?.(errorMsg);
                    reject(new Error(errorMsg));
                }
            };

            uploadXhr.onerror = function () {
                const errorMsg = "Network error during S3 upload";
                onError?.(errorMsg);
                reject(new Error(errorMsg));
            };

            uploadXhr.upload.onprogress = function (event) {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    onProgress?.(`Uploading to S3... ${Math.round(percentComplete)}%`);
                }
            };

            // Send the file directly to S3
            uploadXhr.send(file);

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Upload failed';
            onError?.(errorMsg);
            reject(new Error(errorMsg));
        }
    });
};

export default proxyUploadService;
