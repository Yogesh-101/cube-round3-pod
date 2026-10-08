import React from 'react';

interface BarcodeProps {
  value: string;
  format?: 'CODE128' | 'CODE39';
  height?: number;
  width?: number;
  displayValue?: boolean;
  className?: string;
  lightBackground?: boolean;
}

// Code 39 character patterns (9 elements: 5 bars, 4 spaces. '1' = wide, '0' = narrow)
// Wide = 2.5 units, Narrow = 1 unit.
const CODE39_ENCODINGS: Record<string, string> = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
  '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100',
};

export const Barcode: React.FC<BarcodeProps> = ({
  value,
  height = 48,
  displayValue = true,
  className = '',
  lightBackground = false,
}) => {
  const sanitized = (value || '0000').toUpperCase().replace(/[^0-9A-Z\-\. \$\/\+\%]/g, '-');
  const fullString = `*${sanitized}*`;

  // Build bars and spaces
  // Wide bar = 2.5px, narrow = 1px, gap between chars = 1px
  const elements: { isBar: boolean; width: number }[] = [];

  for (let i = 0; i < fullString.length; i++) {
    const char = fullString[i];
    const pattern = CODE39_ENCODINGS[char] || CODE39_ENCODINGS['-'];

    for (let p = 0; p < pattern.length; p++) {
      const isBar = p % 2 === 0;
      const isWide = pattern[p] === '1';
      elements.push({
        isBar,
        width: isWide ? 2.6 : 1.1,
      });
    }

    // Inter-character space
    if (i < fullString.length - 1) {
      elements.push({ isBar: false, width: 1.2 });
    }
  }

  const totalWidth = elements.reduce((acc, el) => acc + el.width, 0);

  let currentX = 0;
  const barPaths: string[] = [];

  elements.forEach((el) => {
    if (el.isBar) {
      barPaths.push(`M ${currentX.toFixed(2)} 0 L ${(currentX + el.width).toFixed(2)} 0 L ${(currentX + el.width).toFixed(2)} ${height} L ${currentX.toFixed(2)} ${height} Z`);
    }
    currentX += el.width;
  });

  const barColor = lightBackground ? '#0f172a' : '#f8fafc';
  const bgColor = lightBackground ? '#ffffff' : '#090d16';
  const textColor = lightBackground ? '#334155' : '#94a3b8';

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <div
        className="p-2 rounded border"
        style={{
          backgroundColor: bgColor,
          borderColor: lightBackground ? '#e2e8f0' : '#1e293b',
        }}
      >
        <svg
          viewBox={`0 0 ${Math.ceil(totalWidth)} ${height}`}
          width={Math.min(280, Math.ceil(totalWidth * 1.2))}
          height={height}
          className="overflow-visible"
        >
          <path d={barPaths.join(' ')} fill={barColor} />
        </svg>

        {displayValue && (
          <div
            className="text-center font-mono text-[10px] tracking-widest mt-1 font-semibold"
            style={{ color: textColor }}
          >
            {value}
          </div>
        )}
      </div>
    </div>
  );
};
