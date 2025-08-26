const express = require('express');
const aws = require('aws-sdk');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS for React app
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-amz-acl'],
  credentials: true
}));

// Configure AWS
aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new aws.S3();

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Endpoint to get signed URL for S3 upload
app.get('/sign_s3', (req, res) => {
  const fileName = req.query.file_name;
  const fileType = req.query.file_type;
  const bucketName = process.env.S3_BUCKET_NAME;

  console.log('S3 sign request:', { fileName, fileType, bucketName: bucketName ? 'configured' : 'missing' });

  if (!fileName || !fileType) {
    console.error('Missing required parameters:', { fileName, fileType });
    return res.status(400).json({ error: 'Missing file_name or file_type' });
  }

  if (!bucketName) {
    console.error('S3_BUCKET_NAME environment variable not configured');
    return res.status(500).json({ 
      error: 'S3_BUCKET_NAME not configured',
      details: 'Please add S3_BUCKET_NAME to your .env file'
    });
  }

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('AWS credentials not configured');
    return res.status(500).json({ 
      error: 'AWS credentials not configured',
      details: 'Please add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to your .env file'
    });
  }

  const s3Params = {
    Bucket: bucketName,
    Key: fileName,
    Expires: 60, // URL expires in 60 seconds
    ContentType: fileType,
    ACL: 'public-read'
  };

  s3.getSignedUrl('putObject', s3Params, (err, data) => {
    if (err) {
      console.error('Error generating signed URL:', err);
      return res.status(500).json({ error: 'Error generating signed URL' });
    }

    const returnData = {
      signed_request: data,
      url: `https://${bucketName}.s3.amazonaws.com/${fileName}`
    };

    res.json(returnData);
  });
});

// Proxy upload endpoint - handles file upload to S3 via backend
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const fileName = req.body.fileName;
    const bucketName = process.env.S3_BUCKET_NAME;

    console.log('Proxy upload request:', { fileName, fileSize: file?.size, bucketName: bucketName ? 'configured' : 'missing' });

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    if (!fileName) {
      return res.status(400).json({ error: 'No fileName provided' });
    }

    if (!bucketName) {
      return res.status(500).json({ 
        error: 'S3_BUCKET_NAME not configured',
        details: 'Please add S3_BUCKET_NAME to your .env file'
      });
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return res.status(500).json({ 
        error: 'AWS credentials not configured',
        details: 'Please add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to your .env file'
      });
    }

    // Upload to S3
    const uploadParams = {
      Bucket: bucketName,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read'
    };

    const result = await s3.upload(uploadParams).promise();
    const publicUrl = `https://${bucketName}.s3.amazonaws.com/${fileName}`;
    
    console.log('Upload successful:', publicUrl);
    res.json({ 
      success: true, 
      url: publicUrl,
      location: result.Location 
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed', 
      details: error.message 
    });
  }
});

app.listen(port, () => {
  console.log(`S3 upload server running on port ${port}`);
});
