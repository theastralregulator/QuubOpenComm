// Server-side document header signature and ZIP structure verification for OpenComm private media
import { normalizeMimeType } from './validation.js';

export interface DocumentVerificationResult {
  valid: boolean;
  error?: string;
  detectedFamily?: string;
}

/**
 * Extract ZIP entry names and check encryption flag from ZIP buffer.
 * Supports Local File Headers (0x50 0x4B 0x03 0x04) and Central Directory Headers (0x50 0x4B 0x01 0x02).
 */
export function getZipEntryNames(buffer: Buffer): { entryNames: string[]; isEncrypted: boolean } {
  const entryNames: string[] = [];
  let isEncrypted = false;
  let pos = 0;
  const len = buffer.length;

  while (pos <= len - 30) {
    // 1. Local File Header signature (0x50 0x4B 0x03 0x04)
    if (buffer[pos] === 0x50 && buffer[pos + 1] === 0x4b && buffer[pos + 2] === 0x03 && buffer[pos + 3] === 0x04) {
      const flag = buffer.readUInt16LE(pos + 6);
      if (flag & 0x01) {
        isEncrypted = true;
      }
      const filenameLen = buffer.readUInt16LE(pos + 26);
      const extraLen = buffer.readUInt16LE(pos + 28);
      const compressedSize = buffer.readUInt32LE(pos + 18);

      if (pos + 30 + filenameLen <= len) {
        const name = buffer.subarray(pos + 30, pos + 30 + filenameLen).toString('utf8');
        if (name && !entryNames.includes(name)) {
          entryNames.push(name);
        }
      }

      pos += 30 + filenameLen + extraLen + (compressedSize > 0 ? compressedSize : 0);
    }
    // 2. Central Directory Header signature (0x50 0x4B 0x01 0x02)
    else if (buffer[pos] === 0x50 && buffer[pos + 1] === 0x4b && buffer[pos + 2] === 0x01 && buffer[pos + 3] === 0x02) {
      if (pos + 46 > len) break;
      const flag = buffer.readUInt16LE(pos + 8);
      if (flag & 0x01) {
        isEncrypted = true;
      }
      const filenameLen = buffer.readUInt16LE(pos + 28);
      const extraLen = buffer.readUInt16LE(pos + 30);
      const commentLen = buffer.readUInt16LE(pos + 32);

      if (pos + 46 + filenameLen <= len) {
        const name = buffer.subarray(pos + 46, pos + 46 + filenameLen).toString('utf8');
        if (name && !entryNames.includes(name)) {
          entryNames.push(name);
        }
      }
      pos += 46 + filenameLen + extraLen + commentLen;
    } else {
      pos++;
    }
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

    const { entryNames, isEncrypted } = getZipEntryNames(buffer);

    if (isEncrypted) {
      return { valid: false, error: 'Encrypted archives are not permitted.' };
    }

    if (entryNames.length === 0) {
      return { valid: false, error: 'ZIP container contains no readable entries.' };
    }

    // Must contain [Content_Types].xml
    const hasContentTypes = entryNames.some(e => e === '[Content_Types].xml' || e.endsWith('/[Content_Types].xml'));
    if (!hasContentTypes) {
      return { valid: false, error: 'ZIP container missing mandatory OOXML [Content_Types].xml header.' };
    }

    // Family-specific path verification
    if (cleanMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const hasWordPath = entryNames.some(e => e.startsWith('word/'));
      if (!hasWordPath) {
        return { valid: false, error: 'Document structure mismatch: Missing Word (word/) package structure.' };
      }
      if (entryNames.some(e => e.includes('vbaProject.bin'))) {
        return { valid: false, error: 'Macro-enabled Word documents (DOCM/vbaProject) are strictly prohibited.' };
      }
      return { valid: true, detectedFamily: 'docx' };
    }

    if (cleanMime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      const hasExcelPath = entryNames.some(e => e.startsWith('xl/'));
      if (!hasExcelPath) {
        return { valid: false, error: 'Document structure mismatch: Missing Excel (xl/) package structure.' };
      }
      if (entryNames.some(e => e.includes('vbaProject.bin'))) {
        return { valid: false, error: 'Macro-enabled Excel spreadsheets (XLSM/vbaProject) are strictly prohibited.' };
      }
      return { valid: true, detectedFamily: 'xlsx' };
    }

    if (cleanMime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      const hasPptPath = entryNames.some(e => e.startsWith('ppt/'));
      if (!hasPptPath) {
        return { valid: false, error: 'Document structure mismatch: Missing PowerPoint (ppt/) package structure.' };
      }
      if (entryNames.some(e => e.includes('vbaProject.bin'))) {
        return { valid: false, error: 'Macro-enabled PowerPoint presentations (PPTM/vbaProject) are strictly prohibited.' };
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
