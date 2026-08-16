import { verifyDocumentBuffer } from '../api/_lib/media/documentScanner.js';

// 1. Valid PDF
const validPdfBuf = Buffer.from('%PDF-1.7\n%abc...\n1 0 obj\n<<>>\nendobj\n%%EOF');
const resPdf = verifyDocumentBuffer(validPdfBuf, 'application/pdf');
console.log('PDF Test:', resPdf.valid ? 'PASSED' : 'FAILED', resPdf);
if (!resPdf.valid) process.exit(1);

// 2. Renamed Executable (.exe -> .pdf)
const fakePdfBuf = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00');
const resFakePdf = verifyDocumentBuffer(fakePdfBuf, 'application/pdf');
console.log('Renamed EXE to PDF Test (Must fail):', !resFakePdf.valid ? 'PASSED' : 'FAILED', resFakePdf.error);
if (resFakePdf.valid) process.exit(1);

// 3. Valid DOCX
const validDocxBuf = Buffer.from('PK\x03\x04\x14\x00\x00\x00\x08\x00word/document.xml[Content_Types].xml');
const resDocx = verifyDocumentBuffer(validDocxBuf, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
console.log('DOCX Test:', resDocx.valid ? 'PASSED' : 'FAILED', resDocx);
if (!resDocx.valid) process.exit(1);

// 4. Fake ZIP renamed to DOCX
const fakeZipBuf = Buffer.from('PK\x03\x04\x14\x00\x00\x00\x08\x00payload.sh#!/bin/bash echo hello');
const resFakeZip = verifyDocumentBuffer(fakeZipBuf, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
console.log('Fake ZIP to DOCX Test (Must fail):', !resFakeZip.valid ? 'PASSED' : 'FAILED', resFakeZip.error);
if (resFakeZip.valid) process.exit(1);

// 5. HTML injection in TXT
const htmlInTxtBuf = Buffer.from('Hello world\n<script>alert("xss")</script>');
const resHtmlTxt = verifyDocumentBuffer(htmlInTxtBuf, 'text/plain');
console.log('HTML in TXT Test (Must fail):', !resHtmlTxt.valid ? 'PASSED' : 'FAILED', resHtmlTxt.error);
if (resHtmlTxt.valid) process.exit(1);

// 6. Valid TXT
const validTxtBuf = Buffer.from('Hello world, this is a clean text document.\nNo binaries here!');
const resTxt = verifyDocumentBuffer(validTxtBuf, 'text/plain');
console.log('Valid TXT Test:', resTxt.valid ? 'PASSED' : 'FAILED', resTxt);
if (!resTxt.valid) process.exit(1);

console.log('\nAll document scanner security tests passed successfully!');
