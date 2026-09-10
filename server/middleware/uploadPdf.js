import multer from 'multer';

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only .pdf files are allowed.'));
  }
}

const uploadPdf = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});

export default uploadPdf;
