import qrcode from './vendor/qrcode.js';

/**
 * QR generation, fully local (no external QR service, so published links -
 * which carry the app snapshot - never leave the browser).
 * The encoder is the MIT-licensed qrcode-generator 1.4.4 by Kazuhiko Arase,
 * vendored at src/lib/vendor/qrcode.js: the library body is byte-identical to
 * the upstream file (sha256 of the original:
 * 18ae399f81182bc9de916e9c77b195df20cc58d6f2d55a62b085a299f1bf1780,
 * https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js); only its
 * UMD export tail was replaced with `export default qrcode;` for ESM bundling.
 * Its output was verified decodable with OpenCV's QRCodeDetector.
 */

/** Returns the QR module matrix for text (byte mode, ECC M, auto version), or null when it does not fit any QR version. */
export function qrMatrix(text: string): boolean[][] | null {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text, 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    const matrix: boolean[][] = [];
    for (let r = 0; r < n; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
      matrix.push(row);
    }
    return matrix;
  } catch {
    return null;
  }
}

/** Builds one SVG path for the dark modules, including a 4-module quiet zone. */
export function qrSvgPath(matrix: boolean[][]): string {
  let d = '';
  matrix.forEach((row, r) => {
    row.forEach((dark, c) => {
      if (dark) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    });
  });
  return d;
}
