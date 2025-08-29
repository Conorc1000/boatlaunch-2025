const aws = require('aws-sdk');
const multipart = require('lambda-multipart-parser');

// Configure AWS
aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_1,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new aws.S3();

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-amz-acl',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
  };

  // Handle preflight OPTIONS request
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
    // Parse multipart form data
    const result = await multipart.parse(event);
    const file = result.files && result.files[0];
    const fileName = result.fileName;
    const bucketName = process.env.S3_BUCKET_NAME;

    console.log('Proxy upload request:', { 
      fileName, 
      fileSize: file?.content?.length, 
      bucketName: bucketName ? 'configured' : 'missing' 
    });

    if (!file) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No file provided' })
      };
    }

    if (!fileName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No fileName provided' })
      };
    }

    if (!bucketName) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'S3_BUCKET_NAME not configured',
          details: 'Please add S3_BUCKET_NAME to your environment variables'
        })
      };
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY_1) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'AWS credentials not configured',
          details: 'Please add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY_1 to your environment variables'
        })
      };
    }

    // Upload to S3
    const uploadParams = {
      Bucket: bucketName,
      Key: fileName,
      Body: file.content,
      ContentType: file.contentType,
      ACL: 'public-read'
    };

    const uploadResult = await s3.upload(uploadParams).promise();
    const publicUrl = `https://${bucketName}.s3.amazonaws.com/${fileName}`;

    console.log('Upload successful:', publicUrl);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        url: publicUrl,
        location: uploadResult.Location
      })
    };

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
