export interface QrCode {
  addData(data: string, mode?: 'Byte' | 'Numeric' | 'Alphanumeric' | 'Kanji'): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
}
declare function qrcode(typeNumber: number, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'): QrCode;
export default qrcode;
