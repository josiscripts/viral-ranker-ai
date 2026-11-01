import path from 'path';

// Single root for every file the server stores (uploads, temp uploads, export
// jobs). STORAGE_DIR lets tests and other setups use a separate directory; by
// default it is server/storage, whatever directory the server is started from.
export const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || path.join(__dirname, '..', 'storage'));
export const UPLOAD_DIR = path.join(STORAGE_DIR, 'uploads');
export const UPLOAD_TMP_DIR = path.join(STORAGE_DIR, 'tmp');
export const PROCESSING_DIR = path.join(STORAGE_DIR, 'processing');
export const EXPORTS_DIR = path.join(STORAGE_DIR, 'exports');
export const OVERLAYS_DIR = path.join(STORAGE_DIR, 'overlays');
