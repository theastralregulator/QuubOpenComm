// Server-side document header signature and ZIP EOCD Central Directory verification for OpenComm private media
import { normalizeMimeType } from './validation.js';

export interface DocumentVerificationResult {
  valid: boolean;
  error?: string;
  detectedFamily?: string;
}

/**
 * Locates End of Central Directory (EOCD) record and parses ZIP Central Directory entries.
 * Enumerates file names only without decompressing file contents.
 */
export function getZipCentralDirectoryEntries(buffer: Buffer): { entryNames: string[]; isEncrypted: boolean } {
  const len = buffer.length;
  if (len < 22) {
    return { entryNames: [], isEncrypted: false };
  }

  // 1. Locate End of Central Directory (EOCD) Record (0x50 0x4B 0x05 0x06)
  // Search backward from end of buffer (EOCD record is at least 22 bytes, comments up to 65535 bytes)
  const maxSearchLength = Math.min(len, 65557);
  let eocdPos = -1;

  for (let i = len - 22; i >= len - maxSearchLength; i--) {
    if (buffer[i] === 0x50 && buffer[i + 1] === 0x4b && buffer[i + 2] === 0x05 && buffer[i + 3] === 0x06) {
      eocdPos = i;
      break;
    }
  }

  if (eocdPos === -1) {
    return { entryNames: [], isEncrypted: false };
  }

  // Read Central Directory metadata from EOCD
  const totalEntries = buffer.readUInt16LE(eocdPos + 10);
  const cdSize = buffer.readUInt32LE(eocdPos + 12);
  const cdOffset = buffer.readUInt32LE(eocdPos + 16);

  // Bounds and sanity checks
  if (totalEntries > 10000) {
    return { entryNames: [], isEncrypted: false }; // Excessive entry count (reject malformed / zip bomb)
  }
  if (cdOffset < 0 || cdSize < 0 || cdOffset + cdSize > len) {
    return { entryNames: [], isEncrypted: false }; // Malformed out-of-bounds central directory
  }

  const entryNames: string[] = [];
  let isEncrypted = false;
  let pos = cdOffset;
  const cdEnd = cdOffset + cdSize;

  // Enumerate Central Directory Headers (0x50 0x4B 0x01 0x02)
  while (pos + 46 <= cdEnd) {
    if (buffer[pos] !== 0x50 || buffer[pos + 1] !== 0x4b || buffer[pos + 2] !== 0x01 || buffer[pos + 3] !== 0x02) {
      break; // Malformed entry header signature
    }

    const flag = buffer.readUInt16LE(pos + 8);
    if (flag & 0x01) {
      isEncrypted = true;
    }

    const filenameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);

    if (filenameLen > 1024) {
      // Unreasonable filename length
      break;
    }

    if (pos + 46 + filenameLen <= len) {
      const rawName = buffer.subarray(pos + 46, pos + 46 + filenameLen).toString('utf8');
      const normalizedName = rawName.toLowerCase().trim().replace(/\\/g, '/');
      if (normalizedName && !entryNames.includes(normalizedName)) {
        entryNames.push(normalizedName);
      }
    }

    pos += 46 + filenameLen + extraLen + commentLen;
  }

  return { entryNames, isEncrypted };
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
    const headerStr = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('ascii');
    if (!headerStr.includes('%PDF-')) {
      return { valid: false, error: 'Invalid PDF signature. File content does not match PDF specification.' };
    }
    return { valid: true, detectedFamily: 'pdf' };
  }

  // 2. OOXML Office Formats (DOCX, XLSX, PPTX)
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

    const { entryNames, isEncrypted } = getZipCentralDirectoryEntries(buffer);

    if (isEncrypted) {
      return { valid: false, error: 'Encrypted archives are not permitted.' };
    }

    if (entryNames.length === 0) {
      return { valid: false, error: 'ZIP central directory missing or malformed.' };
    }

    // Must contain [content_types].xml
    const hasContentTypes = entryNames.includes('[content_types].xml');
    if (!hasContentTypes) {
      return { valid: false, error: 'ZIP container missing mandatory OOXML [Content_Types].xml header.' };
    }

    // Macro check (case-insensitive search for vbaproject.bin)
    if (entryNames.some(e => e.includes('vbaproject.bin'))) {
      return { valid: false, error: 'Macro-enabled OOXML documents (DOCM/XLSM/PPTM with vbaProject.bin) are strictly prohibited.' };
    }

    // Family-specific core entry verification
    if (cleanMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const hasWordDoc = entryNames.includes('word/document.xml');
      if (!hasWordDoc) {
        return { valid: false, error: 'Document structure mismatch: Missing Word core entry (word/document.xml).' };
      }
      return { valid: true, detectedFamily: 'docx' };
    }

    if (cleanMime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      const hasWorkbook = entryNames.includes('xl/workbook.xml');
      if (!hasWorkbook) {
        return { valid: false, error: 'Document structure mismatch: Missing Excel core entry (xl/workbook.xml).' };
      }
      return { valid: true, detectedFamily: 'xlsx' };
    }

    if (cleanMime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      const hasPresentation = entryNames.includes('ppt/presentation.xml');
      if (!hasPresentation) {
        return { valid: false, error: 'Document structure mismatch: Missing PowerPoint core entry (ppt/presentation.xml).' };
      }
      return { valid: true, detectedFamily: 'pptx' };
    }
  }

  // 3. Plain Text and CSV Formats (text/plain, text/csv)
  if (cleanMime === 'text/plain' || cleanMime === 'text/csv') {
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
