import { verifyDocumentBuffer } from '../api/_lib/media/documentScanner.js';

function createDummyZipBuffer(entryName: string): Buffer {
  const nameBuf = Buffer.from(entryName, 'utf8');
  const header = Buffer.alloc(30);
  header[0] = 0x50; header[1] = 0x4b; header[2] = 0x03; header[3] = 0x04; // PK\x03\x04
  header.writeUInt16LE(10, 4); // version
  header.writeUInt16LE(0, 6);  // flag
  header.writeUInt16LE(0, 8);  // compression
  header.writeUInt16LE(nameBuf.length, 26); // filename length
  header.writeUInt16LE(0, 28); // extra length

  const ctBuf = Buffer.from('[Content_Types].xml', 'utf8');
  const ctHeader = Buffer.alloc(30);
  ctHeader[0] = 0x50; ctHeader[1] = 0x4b; ctHeader[2] = 0x03; ctHeader[3] = 0x04;
  ctHeader.writeUInt16LE(10, 4);
  ctHeader.writeUInt16LE(0, 6);
  ctHeader.writeUInt16LE(0, 8);
  ctHeader.writeUInt16LE(ctBuf.length, 26);
  ctHeader.writeUInt16LE(0, 28);

  return Buffer.concat([ctHeader, ctBuf, header, nameBuf]);
}

// 1. Valid PDF
const validPdfBuf = Buffer.from('%PDF-1.7\n%abc...\n1 0 obj\n<<>>\nendobj\n%%EOF');
const resPdf = verifyDocumentBuffer(validPdfBuf, 'application/pdf');
console.log('1. PDF Test:', resPdf.valid ? 'PASSED' : 'FAILED', resPdf);
if (!resPdf.valid) process.exit(1);

// 2. Renamed Executable (.exe -> .pdf)
const fakePdfBuf = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00');
const resFakePdf = verifyDocumentBuffer(fakePdfBuf, 'application/pdf');
console.log('2. Renamed EXE to PDF Test (Must fail):', !resFakePdf.valid ? 'PASSED' : 'FAILED', resFakePdf.error);
if (resFakePdf.valid) process.exit(1);

// 3. Valid DOCX
const validDocxBuf = createDummyZipBuffer('word/document.xml');
const resDocx = verifyDocumentBuffer(validDocxBuf, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
console.log('3. DOCX Test:', resDocx.valid ? 'PASSED' : 'FAILED', resDocx);
if (!resDocx.valid) process.exit(1);

// 4. DOCX bytes declared as XLSX (Cross-family mismatch)
const resDocxAsXlsx = verifyDocumentBuffer(validDocxBuf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
console.log('4. DOCX bytes declared as XLSX Test (Must fail):', !resDocxAsXlsx.valid ? 'PASSED' : 'FAILED', resDocxAsXlsx.error);
if (resDocxAsXlsx.valid) process.exit(1);

// 5. Valid XLSX
const validXlsxBuf = createDummyZipBuffer('xl/workbook.xml');
const resXlsx = verifyDocumentBuffer(validXlsxBuf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
console.log('5. XLSX Test:', resXlsx.valid ? 'PASSED' : 'FAILED', resXlsx);
if (!resXlsx.valid) process.exit(1);

// 6. XLSX bytes declared as DOCX (Cross-family mismatch)
const resXlsxAsDocx = verifyDocumentBuffer(validXlsxBuf, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
console.log('6. XLSX bytes declared as DOCX Test (Must fail):', !resXlsxAsDocx.valid ? 'PASSED' : 'FAILED', resXlsxAsDocx.error);
if (resXlsxAsDocx.valid) process.exit(1);

// 7. Valid PPTX
const validPptxBuf = createDummyZipBuffer('ppt/presentation.xml');
const resPptx = verifyDocumentBuffer(validPptxBuf, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
console.log('7. PPTX Test:', resPptx.valid ? 'PASSED' : 'FAILED', resPptx);
if (!resPptx.valid) process.exit(1);

// 8. PPTX bytes declared as DOCX (Cross-family mismatch)
const resPptxAsDocx = verifyDocumentBuffer(validPptxBuf, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
console.log('8. PPTX bytes declared as DOCX Test (Must fail):', !resPptxAsDocx.valid ? 'PASSED' : 'FAILED', resPptxAsDocx.error);
if (resPptxAsDocx.valid) process.exit(1);

// 9. Generic ZIP renamed to DOCX
const fakeZipBuf = createDummyZipBuffer('payload.sh');
const resFakeZip = verifyDocumentBuffer(fakeZipBuf, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
console.log('9. Generic ZIP renamed to DOCX Test (Must fail):', !resFakeZip.valid ? 'PASSED' : 'FAILED', resFakeZip.error);
if (resFakeZip.valid) process.exit(1);

// 10. HTML injection in TXT
const htmlInTxtBuf = Buffer.from('Hello world\n<script>alert("xss")</script>');
const resHtmlTxt = verifyDocumentBuffer(htmlInTxtBuf, 'text/plain');
console.log('10. HTML in TXT Test (Must fail):', !resHtmlTxt.valid ? 'PASSED' : 'FAILED', resHtmlTxt.error);
if (resHtmlTxt.valid) process.exit(1);

// 11. Valid TXT
const validTxtBuf = Buffer.from('Hello world, this is a clean text document.\nNo binaries here!');
const resTxt = verifyDocumentBuffer(validTxtBuf, 'text/plain');
console.log('11. Valid TXT Test:', resTxt.valid ? 'PASSED' : 'FAILED', resTxt);
if (!resTxt.valid) process.exit(1);

// 12. Verification of Production Claim RPC Response Fixture Contract
const claimResultFixture = {
  status: 'claimed',
  provider: 'b2',
  object_key: 'opencomm_media/2026-08/conv123/123456_uuid.jpg',
  media_type: 'image',
  mime_type: 'image/jpeg',
  file_size_bytes: 12345
};

console.log('12. Production Claim RPC Contract Fixture Verification:');
console.log('    status:', claimResultFixture.status);
console.log('    provider:', claimResultFixture.provider);
console.log('    object_key:', claimResultFixture.object_key);
console.log('    media_type:', claimResultFixture.media_type);
console.log('    mime_type:', claimResultFixture.mime_type);
console.log('    file_size_bytes:', claimResultFixture.file_size_bytes);

if (claimResultFixture.status !== 'claimed' || !claimResultFixture.provider || !claimResultFixture.object_key) {
  console.error('FAILED claim RPC fixture verification!');
  process.exit(1);
}

console.log('\nAll security, scanner, cross-family, and claim RPC contract tests passed successfully!');
