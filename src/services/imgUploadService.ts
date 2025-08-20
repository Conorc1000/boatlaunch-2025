// TypeScript version of S3 image upload service
// Note: AWS SDK will need to be installed separately: npm install aws-sdk

// const albumBucketName = process.env.REACT_APP_S3_PHOTOS_BUCKET || 'default-bucket';
// const bucketRegion = process.env.REACT_APP_S3_REGION || 'us-east-1';
// const IdentityPoolId = process.env.REACT_APP_COGNITO_IDENTITY_POOL_ID || 'default-pool';

interface UploadResponse {
    signed_request: string;
    url: string;
}

export const imgUploadService = (
    file: File, 
    newImgId: string, 
    onProgress?: (message: string) => void,
    onSuccess?: (url: string) => void,
    onError?: (error: string) => void
): Promise<string> => {
    return new Promise((resolve, reject) => {
        // Note: AWS configuration would be done here when AWS SDK is available
        // For now, we'll proceed with the upload logic

        const xhr = new XMLHttpRequest();
        const fileName = `${newImgId}___Source.jpg`;

        xhr.open("GET", `/sign_s3?file_name=${fileName}&file_type=${file.type}`);

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    console.log("xhr.responseText", xhr.responseText);
                    try {
                        const response: UploadResponse = JSON.parse(xhr.responseText);
                        uploadFile(file, response.signed_request, response.url);
                    } catch (error) {
                        const errorMsg = "Failed to parse server response";
                        onError?.(errorMsg);
                        reject(new Error(errorMsg));
                    }
                } else {
                    const errorMsg = "Could not get signed URL from server";
                    onError?.(errorMsg);
                    reject(new Error(errorMsg));
                }
            }
        };

        xhr.onerror = function() {
            const errorMsg = "Network error while requesting signed URL";
            onError?.(errorMsg);
            reject(new Error(errorMsg));
        };

        xhr.send();

        function uploadFile(file: File, signedRequest: string, url: string) {
            console.log('upload_file, url', url);
            const uploadXhr = new XMLHttpRequest();
            
            uploadXhr.open("PUT", signedRequest);
            uploadXhr.setRequestHeader('x-amz-acl', 'public-read');
            
            uploadXhr.onload = function() {
                if (uploadXhr.status === 200) {
                    const successMsg = 'Image successfully uploaded';
                    onProgress?.(successMsg);
                    onSuccess?.(url);
                    resolve(url);
                } else {
                    const errorMsg = `Upload failed with status: ${uploadXhr.status}`;
                    onError?.(errorMsg);
                    reject(new Error(errorMsg));
                }
            };
            
            uploadXhr.onerror = function() {
                const errorMsg = "Could not upload file to S3";
                onError?.(errorMsg);
                reject(new Error(errorMsg));
            };
            
            uploadXhr.upload.onprogress = function(event) {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    onProgress?.(`Uploading... ${Math.round(percentComplete)}%`);
                }
            };
            
            uploadXhr.send(file);
        }
    });
};

export default imgUploadService;
