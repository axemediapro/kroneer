const multer = require('./miniMulter');
const path = require('path');
const fs = require('fs');

// Sigurojmë që folderi i ngarkimit të logove ekziston
const logosDir = path.join(__dirname, '../../public/uploads/logos');
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

// Sigurojmë që folderi i ngarkimit të vulave dhe nënshkrimeve ekziston
const stampsDir = path.join(__dirname, '../../public/uploads/stamps');
if (!fs.existsSync(stampsDir)) {
  fs.mkdirSync(stampsDir, { recursive: true });
}

// Sigurojmë që folderi i galerisë së lifteve (foto/video) ekziston
const elevatorsDir = path.join(__dirname, '../../public/uploads/elevators');
if (!fs.existsSync(elevatorsDir)) {
  fs.mkdirSync(elevatorsDir, { recursive: true });
}

// Konfigurimi i ruajtjes me emërtime unike dhe të pastra
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(logosDir)) {
      fs.mkdirSync(logosDir, { recursive: true });
    }
    cb(null, logosDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.svg';
    const cleanBase = path.basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 25);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `logo_${cleanBase}_${uniqueSuffix}${ext}`);
  }
});

// Ruajtja e vulës dhe nënshkrimit zyrtar (.png, .webp, .svg, .jpg)
const stampStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(stampsDir)) {
      fs.mkdirSync(stampsDir, { recursive: true });
    }
    cb(null, stampsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const cleanBase = path.basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 25);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `vula_nenshkrimi_${cleanBase}_${uniqueSuffix}${ext}`);
  }
});

// Filtruesi i tipit të skedarit (SVG, PNG, JPG, JPEG, WEBP)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.svg', '.png', '.jpg', '.jpeg', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  const isSvgMime = file.mimetype === 'image/svg+xml' || file.mimetype === 'text/xml' || file.mimetype === 'image/svg';
  const isImageMime = file.mimetype && file.mimetype.startsWith('image/');

  if (allowedExtensions.includes(ext) || isSvgMime || isImageMime) {
    cb(null, true);
  } else {
    cb(new Error('Formati i skedarit nuk mbështetet. Ju lutem ngarkoni skedar SVG, PNG, JPG ose WEBP.'), false);
  }
};

const uploadLogo = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB Max
  }
});

const uploadStamp = multer({
  storage: stampStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB Max
  }
});

// Ngarkimi i galerisë së lifteve (foto ose video) - për katalogun & pamjen publike
const elevatorMediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(elevatorsDir)) {
      fs.mkdirSync(elevatorsDir, { recursive: true });
    }
    cb(null, elevatorsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const cleanBase = path.basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 25);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, `elevator_${cleanBase}_${uniqueSuffix}${ext}`);
  }
});

const uploadElevatorMedia = multer({
  storage: elevatorMediaStorage,
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype && file.mimetype.startsWith('image/');
    const isVideo = file.mimetype && file.mimetype.startsWith('video/');
    if (isImage || isVideo) {
      cb(null, true);
    } else {
      cb(new Error('Ju lutem ngarkoni vetëm foto (JPG/PNG/WEBP) ose video (MP4/WEBM).'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB Max (video)
  }
});

// Ngarkimi i skedarit .json për Restore të bazës së të dhënave (mbahet vetëm në memorie, s'ruhet në disk)
const uploadBackupJson = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.json' || file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Ju lutem ngarkoni vetëm skedar backup në format .json.'), false);
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100 MB Max
  }
});

/**
 * Funksion përpunimi për skedarët SVG:
 * - Siguron që ekziston viewBox dhe preserveAspectRatio="xMidYMid meet"
 * - Shmang deformimin e dimensioneve (distortion) kur shfaqet në madhësi të ndryshme
 */
function normalizeSvgFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    let content = fs.readFileSync(filePath, 'utf8');

    // Kontrollojmë nëse përmbajtja është vërtet SVG
    if (!content.includes('<svg') || !content.includes('</svg>')) {
      return content;
    }

    // Sigurohemi që ka preserveAspectRatio="xMidYMid meet"
    if (!content.includes('preserveAspectRatio')) {
      content = content.replace(/<svg\b([^>]*)>/i, (match, attrs) => {
        return `<svg${attrs} preserveAspectRatio="xMidYMid meet">`;
      });
    }

    // Nëse mungon viewBox por ka width dhe height numerike, shtojmë viewBox
    if (!content.includes('viewBox')) {
      const widthMatch = content.match(/\bwidth=["']([0-9.]+)(px)?["']/i);
      const heightMatch = content.match(/\bheight=["']([0-9.]+)(px)?["']/i);

      if (widthMatch && heightMatch) {
        const w = parseFloat(widthMatch[1]);
        const h = parseFloat(heightMatch[1]);
        if (w > 0 && h > 0) {
          content = content.replace(/<svg\b([^>]*)>/i, (match, attrs) => {
            return `<svg${attrs} viewBox="0 0 ${w} ${h}">`;
          });
        }
      }
    }

    fs.writeFileSync(filePath, content, 'utf8');
    return content;
  } catch (err) {
    console.error('Gabim gjatë normalizimit të SVG:', err);
    return null;
  }
}

module.exports = {
  uploadLogo,
  uploadStamp,
  uploadBackupJson,
  uploadElevatorMedia,
  normalizeSvgFile
};
