const aws = require('aws-sdk');

// Configure AWS
aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID_1,
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

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const fileName = event.queryStringParameters?.file_name;
    const fileType = event.queryStringParameters?.file_type;
    const bucketName = process.env.S3_BUCKET_NAME;

    console.log('S3 sign request:', { fileName, fileType, bucketName: bucketName ? 'configured' : 'missing' });

    if (!fileName || !fileType) {
      console.error('Missing required parameters:', { fileName, fileType });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing file_name or file_type' })
      };
    }

    if (!bucketName) {
      console.error('S3_BUCKET_NAME environment variable not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'S3_BUCKET_NAME not configured',
          details: 'Please add S3_BUCKET_NAME to your environment variables'
        })
      };
    }

    if (!process.env.AWS_ACCESS_KEY_ID_1 || !process.env.AWS_SECRET_ACCESS_KEY_1) {
      console.error('AWS credentials not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'AWS credentials not configured',
          details: 'Please add AWS_ACCESS_KEY_ID_1 and AWS_SECRET_ACCESS_KEY_1 to your environment variables'
        })
      };
    }

    const s3Params = {
      Bucket: bucketName,
      Key: fileName,
      Expires: 60, // URL expires in 60 seconds
      ContentType: fileType,
      ACL: 'public-read'
    };

    const signedUrl = await new Promise((resolve, reject) => {
      s3.getSignedUrl('putObject', s3Params, (err, data) => {
        if (err) {
          console.error('Error generating signed URL:', err);
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

    const returnData = {
      signed_request: signedUrl,
      url: `https://${bucketName}.s3.amazonaws.com/${fileName}`
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(returnData)
    };

  } catch (error) {
    console.error('Error generating signed URL:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error generating signed URL' })
    };
  }
};
