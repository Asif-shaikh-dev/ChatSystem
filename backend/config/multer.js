const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'chat_uploads',
    resource_type: 'auto',
  },
});

const upload = multer({ storage: storage });

module.exports = upload;
