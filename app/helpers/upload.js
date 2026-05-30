const multer  = require('multer');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

// usa memória em vez de disco
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const extsPermitidas  = ['.svg', '.png', '.jpg', '.jpeg', '.webp'];
    const mimesPermitidos = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'];
    const ext  = require('path').extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    if (extsPermitidas.includes(ext) && mimesPermitidos.includes(mime)) {
        cb(null, true);
    } else {
        cb(new Error('Apenas SVG, PNG, JPG ou WEBP são permitidos!'));
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter
});

// faz upload do buffer para o Cloudinary
function uploadToCloudinary(buffer, folder) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder },
            (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
}

module.exports = { upload, uploadToCloudinary };