import { verifyDocumentBuffer } from '../api/_lib/media/documentScanner.js';

/**
 * Creates a valid ZIP buffer where Central Directory and entries can be padded past 64KB.
 */
function createPaddedZipBuffer(coreEntry: string, padSizeBefore: number = 0, isEncrypted: boolean = false): Buffer {
  const localHeaders: Buffer[] = [];
  const cdHeaders: Buffer[] = [];

  // Helper to add local header & central dir header
  const addEntry = (name: string) => {
    const nameBuf = Buffer.from(name, 'utf8');

    // Local Header
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    lh.writeUInt16LE(10, 4); // ver
    lh.writeUInt16LE(isEncrypted ? 1 : 0, 6); // flag
    lh.writeUInt16LE(0, 8); // comp
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);

    const localOffset = localHeaders.reduce((acc, b) => acc + b.length, 0);
    localHeaders.push(lh, nameBuf);

    // Central Directory Header
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); // PK\x01\x02
    cd.writeUInt16LE(10, 4);
    cd.writeUInt16LE(isEncrypted ? 1 : 0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt32LE(localOffset, 42);

    cdHeaders.push(cd, nameBuf);
  };

  // Add [Content_Types].xml
  addEntry('[Content_Types].xml');

  // If padding requested, insert a dummy payload before core entry
  if (padSizeBefore > 0) {
    const dummyData = Buffer.alloc(padSizeBefore, 0x41); // 'A' padding
    localHeaders.push(dummyData);
  }

  // Add the primary core entry (word/document.xml, xl/workbook.xml, etc.)
  addEntry(coreEntry);

  const localBuf = Buffer.concat(localHeaders);
  const cdOffset = localBuf.length;
  const cdBuf = Buffer.concat(cdHeaders);

  // End of Central Directory (EOCD) Record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // PK\x05\x06
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(2, 8);  // 2 total entries
  eocd.writeUInt16LE(2, 10); // 2 cd entries
  eocd.writeUInt32LE(cdBuf.length, 12); // cd size
  eocd.writeUInt32LE(cdOffset, 16);     // cd offset
  eocd.writeUInt16LE(0, 20);            // comment len

  return Buffer.concat([localBuf, cdBuf, eocd]);
}

// 1. PDF Test
const validPdfBuf = Buffer.from('%PDF-1.7\n%abc...\n1 0 obj\n<<>>\nendobj\n%%EOF');
const resPdf = verifyDocumentBuffer(validPdfBuf, 'application/pdf');
console.log('1. PDF Test:', resPdf.valid ? 'PASSED' : 'FAILED', resPdf);
if (!resPdf.valid) process.exit(1);

// 2. DOCX after 64KB padding
const docxPast64k = createPaddedZipBuffer('word/document.xml', 70000);
const resDocx64k = verifyDocumentBuffer(docxPast64k, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
console.log('2. DOCX past 64KB Test:', resDocx64k.valid ? 'PASSED' : 'FAILED', resDocx64k);
if (!resDocx64k.valid) process.exit(1);

// 3. XLSX after 64KB padding
const xlsxPast64k = createPaddedZipBuffer('xl/workbook.xml', 70000);
const resXlsx64k = verifyDocumentBuffer(xlsxPast64k, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
console.log('3. XLSX past 64KB Test:', resXlsx64k.valid ? 'PASSED' : 'FAILED', resXlsx64k);
if (!resXlsx64k.valid) process.exit(1);

// 4. PPTX after 64KB padding
const pptxPast64k = createPaddedZipBuffer('ppt/presentation.xml', 70000);
const resPptx64k = verifyDocumentBuffer(pptxPast64k, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
console.log('4. PPTX past 64KB Test:', resPptx64k.valid ? 'PASSED' : 'FAILED', resPptx64k);
if (!resPptx64k.valid) process.exit(1);

// 5. DOCX declared as XLSX (Cross-family)
const resDocxAsXlsx = verifyDocumentBuffer(docxPast64k, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
console.log('5. DOCX declared as XLSX (Must fail):', !resDocxAsXlsx.valid ? 'PASSED' : 'FAILED', resDocxAsXlsx.error);
if (resDocxAsXlsx.valid) process.exit(1);

// 6. XLSX declared as DOCX (Cross-family)
const resXlsxAsDocx = verifyDocumentBuffer(xlsxPast64k, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
console.log('6. XLSX declared as DOCX (Must fail):', !resXlsxAsDocx.valid ? 'PASSED' : 'FAILED', resXlsxAsDocx.error);
if (resXlsxAsDocx.valid) process.exit(1);

// 7. PPTX declared as DOCX (Cross-family)
const resPptxAsDocx = verifyDocumentBuffer(pptxPast64k, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
console.log('7. PPTX declared as DOCX (Must fail):', !resPptxAsDocx.valid ? 'PASSED' : 'FAILED', resPptxAsDocx.error);
if (resPptxAsDocx.valid) process.exit(1);

// 8. Generic ZIP renamed DOCX
const genericZip = createPaddedZipBuffer('payload.sh');
const resGenericZip = verifyDocumentBuffer(genericZip, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
console.log('8. Generic ZIP renamed DOCX (Must fail):', !resGenericZip.valid ? 'PASSED' : 'FAILED', resGenericZip.error);
if (resGenericZip.valid) process.exit(1);

// 9. DOCM / vbaProject.bin renamed DOCX
const docmZip = createPaddedZipBuffer('word/vbaProject.bin');
const resDocm = verifyDocumentBuffer(docmZip, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
console.log('9. DOCM with vbaProject.bin (Must fail):', !resDocm.valid ? 'PASSED' : 'FAILED', resDocm.error);
if (resDocm.valid) process.exit(1);

// 10. Encrypted OOXML
const encZip = createPaddedZipBuffer('word/document.xml', 0, true);
const resEnc = verifyDocumentBuffer(encZip, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
console.log('10. Encrypted OOXML (Must fail):', !resEnc.valid ? 'PASSED' : 'FAILED', resEnc.error);
if (resEnc.valid) process.exit(1);

// 11. Malformed Central Directory
const malformedZip = Buffer.from('PK\x03\x04\x00\x00\x00\x00\x00\x00PK\x05\x06\x00\x00\x00\x00\x01\x00\x01\x00\xff\xff\xff\xff\xff\xff\xff\xff\x00\x00');
const resMalformed = verifyDocumentBuffer(malformedZip, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
console.log('11. Malformed Central Directory (Must fail):', !resMalformed.valid ? 'PASSED' : 'FAILED', resMalformed.error);
if (resMalformed.valid) process.exit(1);

console.log('\nAll 11 EOCD, Central Directory, 64KB+ padding, and OOXML scanner security tests passed successfully!');
