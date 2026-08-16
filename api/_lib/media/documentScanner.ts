// Server-side document header signature and magic-number verification for OpenComm private media
import { normalizeMimeType } from './validation.js';

export interface DocumentVerificationResult {
  valid: boolean;
  error?: string;
  detectedFamily?: string;
}

/**
 * Verify document buffer header magic bytes and structural signatures server-side.
 * Does not execute code or parse macros. Bounded for <=20MB files.
 */
export function verifyDocumentBuffer(
  buffer: Buffer,
  mimeType: string
): DocumentVerificationResult {
  if (!buffer || buffer.length < 8) {
    return { valid: false, error: 'File buffer is empty or too short.' };
  }

  const cleanMime = normalizeMimeType(mimeType);

  // 1. PDF Verification (application/pdf)
  if (cleanMime === 'application/pdf') {
    // Check first 1024 bytes for %PDF- signature (0x25 0x50 0x44 0x46 0x2D)
    const headerStr = buffer.subarray(0, 1024).toString('ascii');
    if (!headerStr.includes('%PDF-')) {
      return { valid: false, error: 'Invalid PDF signature. File content does not match PDF specification.' };
    }
    return { valid: true, detectedFamily: 'pdf' };
  }

  // 2. Legacy Microsoft Office Binary Formats (DOC, XLS, PPT)
  const legacyMimes = [
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint'
  ];

  if (legacyMimes.includes(cleanMime)) {
    // Microsoft OLE2 Compound File header magic bytes: D0 CF 11 E0 A1 B1 1A E1
    const oleHeader = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    let isOleMatch = true;
    for (let i = 0; i < oleHeader.length; i++) {
      if (buffer[i] !== oleHeader[i]) {
        isOleMatch = false;
        break;
      }
    }

    if (!isOleMatch) {
      return { valid: false, error: 'Invalid legacy Office document binary header signature.' };
    }
    return { valid: true, detectedFamily: 'legacy_office' };
  }

  // 3. OOXML Office Formats (DOCX, XLSX, PPTX)
  const ooxmlMimes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];

  if (ooxmlMimes.includes(cleanMime)) {
    // Standard ZIP Local File Header magic bytes: 0x50 0x4B 0x03 0x04 ("PK\x03\x04")
    const isZipHeader = buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    if (!isZipHeader) {
      return { valid: false, error: 'Invalid OOXML document. File is not a valid ZIP container.' };
    }

    // Convert first 64KB to string (latin1/ascii) to search for OOXML structural path indicators
    const contentSample = buffer.subarray(0, Math.min(buffer.length, 65536)).toString('latin1');

    if (cleanMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const hasWordStructure = contentSample.includes('word/') || contentSample.includes('wordprocessingml') || contentSample.includes('[Content_Types].xml');
      if (!hasWordStructure) {
        return { valid: false, error: 'ZIP container does not contain expected Word (DOCX) document structure.' };
      }
      return { valid: true, detectedFamily: 'docx' };
    }

    if (cleanMime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      const hasExcelStructure = contentSample.includes('xl/') || contentSample.includes('spreadsheetml') || contentSample.includes('[Content_Types].xml');
      if (!hasExcelStructure) {
        return { valid: false, error: 'ZIP container does not contain expected Excel (XLSX) document structure.' };
      }
      return { valid: true, detectedFamily: 'xlsx' };
    }

    if (cleanMime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      const hasPptStructure = contentSample.includes('ppt/') || contentSample.includes('presentationml') || contentSample.includes('[Content_Types].xml');
      if (!hasPptStructure) {
        return { valid: false, error: 'ZIP container does not contain expected PowerPoint (PPTX) document structure.' };
      }
      return { valid: true, detectedFamily: 'pptx' };
    }
  }

  // 4. Plain Text and CSV Formats (text/plain, text/csv)
  if (cleanMime === 'text/plain' || cleanMime === 'text/csv') {
    // Check for Executable Headers
    // Windows PE Executable ("MZ" = 0x4D 0x5A)
    if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
      return { valid: false, error: 'Executable binary data detected. Windows PE files are strictly prohibited.' };
    }
    // Linux ELF Executable ("\x7fELF" = 0x7F 0x45 0x4C 0x46)
    if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
      return { valid: false, error: 'Executable binary data detected. Linux ELF files are strictly prohibited.' };
    }
    // Mach-O Executables
    if ((buffer[0] === 0xfe && buffer[1] === 0xed && buffer[2] === 0xfa && buffer[3] === 0xce) ||
        (buffer[0] === 0xcf && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe) ||
        (buffer[0] === 0xca && buffer[1] === 0xfe && buffer[2] === 0xba && buffer[3] === 0xbe)) {
      return { valid: false, error: 'Executable binary data detected. Mach-O files are strictly prohibited.' };
    }

    const sampleSize = Math.min(buffer.length, 4096);
    const sampleStr = buffer.subarray(0, sampleSize).toString('utf8').toLowerCase();

    // Check for HTML / SVG / Script injection patterns
    if (sampleStr.includes('<html') || sampleStr.includes('<!doctype html') || sampleStr.includes('<svg') || sampleStr.includes('<?xml') || sampleStr.includes('<script')) {
      return { valid: false, error: 'HTML, SVG, or script tags detected in text document.' };
    }

    // Binary / NUL byte check
    let nulCount = 0;
    for (let i = 0; i < sampleSize; i++) {
      if (buffer[i] === 0x00) nulCount++;
    }

    if (nulCount > 0) {
      return { valid: false, error: 'Binary data detected in text file.' };
    }

    return { valid: true, detectedFamily: cleanMime === 'text/csv' ? 'csv' : 'txt' };
  }

  return { valid: false, error: `Unsupported document MIME type '${mimeType}'.` };
}
