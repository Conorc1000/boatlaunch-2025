const AWS = require('aws-sdk');
const Busboy = require('busboy');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID_1,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_1,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-amz-acl',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Content-Type must be multipart/form-data' })
      };
    }

    // Use busboy for proper multipart parsing
    return new Promise((resolve, reject) => {
      let fileBuffer = null;
      let fileName = '';
      let contentTypeFile = 'application/octet-stream';

      const busboy = Busboy({
        headers: {
          'content-type': contentType
        }
      });

      busboy.on('file', (fieldname, file, info) => {
        console.log('Busboy file field:', fieldname, 'filename:', info.filename, 'mimetype:', info.mimeType);
        
        if (fieldname === 'file') {
          contentTypeFile = info.mimeType || 'application/octet-stream';
          const chunks = [];
          
          file.on('data', (chunk) => {
            chunks.push(chunk);
          });
          
          file.on('end', () => {
            fileBuffer = Buffer.concat(chunks);
            console.log('File received, size:', fileBuffer.length);
            
            // Debug: Check JPEG header integrity
            if (fileBuffer && fileBuffer.length > 10) {
              const header = fileBuffer.slice(0, 10);
              console.log('JPEG header hex:', header.toString('hex'));
              console.log('JPEG header bytes:', Array.from(header));
              
              // Check if it starts with JPEG magic bytes (FF D8)
              if (header[0] === 0xFF && header[1] === 0xD8) {
                console.log(' Valid JPEG magic bytes detected');
              } else {
                console.log(' Invalid JPEG magic bytes - file corrupted');
              }
            }
          });
        }
      });

      busboy.on('field', (fieldname, value) => {
        console.log('Busboy field:', fieldname, 'value:', value);
        if (fieldname === 'fileName') {
          fileName = value;
        }
      });

      busboy.on('finish', async () => {
        try {
          console.log('Parsed upload data:', {
            fileName,
            hasFile: !!fileBuffer,
            fileSize: fileBuffer?.length,
            contentType: contentTypeFile,
            bucketName: process.env.S3_BUCKET_NAME ? 'configured' : 'missing'
          });

          if (!fileBuffer) {
            resolve({
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'No file provided' })
            });
            return;
          }

          const bucketName = process.env.S3_BUCKET_NAME;
          if (!fileName) {
            resolve({
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'No fileName provided' })
            });
            return;
          }

          if (!bucketName) {
            resolve({
              statusCode: 500,
              headers,
              body: JSON.stringify({
                error: 'S3_BUCKET_NAME not configured',
                details: 'Please add S3_BUCKET_NAME to your environment variables'
              })
            });
            return;
          }

          if (!process.env.AWS_ACCESS_KEY_ID_1 || !process.env.AWS_SECRET_ACCESS_KEY_1) {
            resolve({
              statusCode: 500,
              headers,
              body: JSON.stringify({
                error: 'AWS credentials not configured',
                details: 'Please add AWS_ACCESS_KEY_ID_1 and AWS_SECRET_ACCESS_KEY_1 to your environment variables'
              })
            });
            return;
          }

          // Upload to S3
          const uploadParams = {
            Bucket: bucketName,
            Key: fileName,
            Body: fileBuffer,
            ContentType: contentTypeFile || 'image/jpeg',
            ACL: 'public-read'
          };

          console.log('S3 upload params:', {
            key: fileName,
            bodySize: fileBuffer.length,
            isBuffer: Buffer.isBuffer(fileBuffer),
            contentType: uploadParams.ContentType
          });

          const uploadResult = await s3.upload(uploadParams).promise();
          const publicUrl = `https://${bucketName}.s3.amazonaws.com/${fileName}`;

          console.log('Upload successful:', publicUrl);
          resolve({
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              url: publicUrl,
              location: uploadResult.Location
            })
          });
        } catch (error) {
          console.error('Upload error:', error);
          resolve({
            statusCode: 500,
            headers,
            body: JSON.stringify({
              error: 'Upload failed',
              details: error.message
            })
          });
        }
      });

      busboy.on('error', (err) => {
        console.error('Busboy error:', err);
        resolve({
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Multipart parsing failed', details: err.message })
        });
      });

      // Write the request body to busboy
      const body = event.isBase64Encoded ? 
        Buffer.from(event.body, 'base64') : 
        Buffer.from(event.body, 'latin1');
      
      busboy.write(body);
      busboy.end();
    });

  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Upload failed',
        details: error.message
      })
    };
  }
};
