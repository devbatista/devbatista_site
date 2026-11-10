// Codificador de QR Code copiado sem alteração da página do evento (rr_eventos @861edfb), que por
// sua vez é o porte do rqrcode_core usado pelo painel. Usado pelo painel e pelo "Como testar".
(function () {
"use strict";
      const QR_QUIET_ZONE = 4;

      function darkRuns(matrix) {
        const runs = [];

        matrix.forEach((row, y) => {
          let start = null;

          row.forEach((dark, x) => {
            if (dark && start === null) start = x;
            if (!dark && start !== null) {
              runs.push({ x: start, y, width: x - start });
              start = null;
            }
          });

          if (start !== null) runs.push({ x: start, y, width: row.length - start });
        });

        return runs;
      }

      function qrCodeSvg(matrix, scale) {
        const size = matrix.length + QR_QUIET_ZONE * 2;
        const rects = darkRuns(matrix)
          .map((run) => `<rect x="${run.x + QR_QUIET_ZONE}" y="${run.y + QR_QUIET_ZONE}" width="${run.width}" height="1"/>`)
          .join("");

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size * scale}" height="${size * scale}" ` +
               `viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" ` +
               `aria-label="QR Code do credenciamento">` +
               `<rect width="${size}" height="${size}" fill="#ffffff"/>` +
               `<g fill="#000000">${rects}</g></svg>`;
      }

      function qrCodePng(matrix, scale) {
        const size = matrix.length + QR_QUIET_ZONE * 2;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size * scale;

        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#000000";

        for (const run of darkRuns(matrix)) {
          context.fillRect((run.x + QR_QUIET_ZONE) * scale, (run.y + QR_QUIET_ZONE) * scale, run.width * scale, scale);
        }

        return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      }

      const QR_RS_BLOCKS = [[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]];

      const QR_ALIGNMENT = [[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]];

      const QR_LEVEL_INDEX = { L: 0, M: 1, Q: 2, H: 3 };
      const QR_LEVEL_BITS = { L: 1, M: 0, Q: 3, H: 2 };

      const GF_EXP = new Uint8Array(512);
      const GF_LOG = new Uint8Array(256);

      for (let i = 0, x = 1; i < 255; i++) {
        GF_EXP[i] = x;
        GF_LOG[x] = i;
        x <<= 1;
        if (x & 0x100) x ^= 0x11d;
      }
      for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];

      function gfMultiply(a, b) {
        if (a === 0 || b === 0) return 0;
        return GF_EXP[GF_LOG[a] + GF_LOG[b]];
      }

      function rsGenerator(count) {
        let poly = [1];

        for (let i = 0; i < count; i++) {
          const next = new Array(poly.length + 1).fill(0);

          for (let j = 0; j < poly.length; j++) {
            next[j] ^= poly[j];
            next[j + 1] ^= gfMultiply(poly[j], GF_EXP[i]);
          }

          poly = next;
        }

        return poly;
      }

      function rsRemainder(data, eccCount) {
        const generator = rsGenerator(eccCount);
        const remainder = new Array(eccCount).fill(0);

        for (const byte of data) {
          const factor = byte ^ remainder[0];
          remainder.shift();
          remainder.push(0);

          for (let i = 0; i < eccCount; i++) {
            remainder[i] ^= gfMultiply(generator[i + 1], factor);
          }
        }

        return remainder;
      }

      function rsBlocksFor(version, level) {
        const entry = QR_RS_BLOCKS[(version - 1) * 4 + QR_LEVEL_INDEX[level]];
        const blocks = [];

        for (let i = 0; i < entry.length; i += 3) {
          const [count, total, dataCount] = [entry[i], entry[i + 1], entry[i + 2]];
          for (let n = 0; n < count; n++) blocks.push({ total, dataCount });
        }

        return blocks;
      }

      function lengthBits(version) {
        return version < 10 ? 8 : 16;
      }

      function capacityInBytes(version, level) {
        return rsBlocksFor(version, level).reduce((sum, block) => sum + block.dataCount, 0);
      }

      function smallestVersion(byteLength, level) {
        for (let version = 1; version <= 40; version++) {
          const needed = 4 + lengthBits(version) + byteLength * 8;
          if (needed <= capacityInBytes(version, level) * 8) return version;
        }

        throw new Error("conteúdo longo demais para um QR Code");
      }

      class BitBuffer {
        constructor() {
          this.bytes = [];
          this.length = 0;
        }

        put(value, bits) {
          for (let i = bits - 1; i >= 0; i--) this.putBit(((value >>> i) & 1) === 1);
        }

        putBit(bit) {
          const index = Math.floor(this.length / 8);
          if (this.bytes.length <= index) this.bytes.push(0);
          if (bit) this.bytes[index] |= 0x80 >>> (this.length % 8);
          this.length++;
        }
      }

      function encodeData(bytes, version, level) {
        const totalData = capacityInBytes(version, level);
        const buffer = new BitBuffer();

        buffer.put(4, 4);
        buffer.put(bytes.length, lengthBits(version));
        for (const byte of bytes) buffer.put(byte, 8);

        if (buffer.length + 4 <= totalData * 8) buffer.put(0, 4);
        while (buffer.length % 8 !== 0) buffer.putBit(false);

        while (buffer.bytes.length < totalData) {
          buffer.bytes.push(0xec);
          if (buffer.bytes.length < totalData) buffer.bytes.push(0x11);
        }

        return buffer.bytes;
      }

      function interleave(dataBytes, version, level) {
        const blocks = rsBlocksFor(version, level);
        const data = [];
        const ecc = [];
        let offset = 0;

        for (const block of blocks) {
          const chunk = dataBytes.slice(offset, offset + block.dataCount);
          offset += block.dataCount;
          data.push(chunk);
          ecc.push(rsRemainder(chunk, block.total - block.dataCount));
        }

        const result = [];
        const maxData = Math.max(...data.map((b) => b.length));
        const maxEcc = Math.max(...ecc.map((b) => b.length));

        for (let i = 0; i < maxData; i++) {
          for (const block of data) if (i < block.length) result.push(block[i]);
        }
        for (let i = 0; i < maxEcc; i++) {
          for (const block of ecc) if (i < block.length) result.push(block[i]);
        }

        return result;
      }

      const BCH_G15 = 0b10100110111;
      const BCH_G15_MASK = 0b101010000010010;
      const BCH_G18 = 0b1111100100101;

      function bchDigit(value) {
        let digits = 0;
        while (value !== 0) {
          digits++;
          value >>>= 1;
        }
        return digits;
      }

      function bchTypeInfo(data) {
        let d = data << 10;
        while (bchDigit(d) - bchDigit(BCH_G15) >= 0) d ^= BCH_G15 << (bchDigit(d) - bchDigit(BCH_G15));
        return ((data << 10) | d) ^ BCH_G15_MASK;
      }

      function bchTypeNumber(data) {
        let d = data << 12;
        while (bchDigit(d) - bchDigit(BCH_G18) >= 0) d ^= BCH_G18 << (bchDigit(d) - bchDigit(BCH_G18));
        return (data << 12) | d;
      }

      function maskAt(pattern, row, col) {
        switch (pattern) {
          case 0: return (row + col) % 2 === 0;
          case 1: return row % 2 === 0;
          case 2: return col % 3 === 0;
          case 3: return (row + col) % 3 === 0;
          case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
          case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
          case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
          case 7: return (((row * col) % 3) + ((row + col) % 2)) % 2 === 0;
          default: throw new Error(`máscara inválida: ${pattern}`);
        }
      }

      function buildMatrix(version, level, codewords, maskPattern, test) {
        const size = version * 4 + 17;
        const modules = Array.from({ length: size }, () => new Array(size).fill(null));

        const drawFinder = (row, col) => {
          for (let r = -1; r <= 7; r++) {
            if (row + r < 0 || size <= row + r) continue;
            for (let c = -1; c <= 7; c++) {
              if (col + c < 0 || size <= col + c) continue;
              const onBorder = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                               (c >= 0 && c <= 6 && (r === 0 || r === 6));
              const inCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
              modules[row + r][col + c] = onBorder || inCenter;
            }
          }
        };

        drawFinder(0, 0);
        drawFinder(size - 7, 0);
        drawFinder(0, size - 7);

        const positions = QR_ALIGNMENT[version - 1];
        for (const row of positions) {
          for (const col of positions) {
            if (modules[row][col] !== null) continue;
            for (let r = -2; r <= 2; r++) {
              for (let c = -2; c <= 2; c++) {
                modules[row + r][col + c] = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
              }
            }
          }
        }

        for (let i = 8; i < size - 8; i++) {
          if (modules[i][6] === null) modules[i][6] = i % 2 === 0;
          if (modules[6][i] === null) modules[6][i] = i % 2 === 0;
        }

        const formatBits = bchTypeInfo((QR_LEVEL_BITS[level] << 3) | maskPattern);
        for (let i = 0; i < 15; i++) {
          const dark = !test && ((formatBits >> i) & 1) === 1;

          if (i < 6) modules[i][8] = dark;
          else if (i < 8) modules[i + 1][8] = dark;
          else modules[size - 15 + i][8] = dark;

          if (i < 8) modules[8][size - i - 1] = dark;
          else if (i < 9) modules[8][15 - i - 1 + 1] = dark;
          else modules[8][15 - i - 1] = dark;
        }
        modules[size - 8][8] = !test;

        if (version >= 7) {
          const versionBits = bchTypeNumber(version);
          for (let i = 0; i < 18; i++) {
            const dark = !test && ((versionBits >> i) & 1) === 1;
            modules[Math.floor(i / 3)][(i % 3) + size - 8 - 3] = dark;
            modules[(i % 3) + size - 8 - 3][Math.floor(i / 3)] = dark;
          }
        }

        let inc = -1;
        let row = size - 1;
        let bitIndex = 7;
        let byteIndex = 0;

        for (let col = size - 1; col > 0; col -= 2) {
          if (col === 6) col--;

          for (;;) {
            for (let c = 0; c < 2; c++) {
              if (modules[row][col - c] !== null) continue;

              let dark = byteIndex < codewords.length &&
                         ((codewords[byteIndex] >>> bitIndex) & 1) === 1;

              if (maskAt(maskPattern, row, col - c)) dark = !dark;

              modules[row][col - c] = dark;
              bitIndex--;

              if (bitIndex === -1) {
                byteIndex++;
                bitIndex = 7;
              }
            }

            row += inc;

            if (row < 0 || size <= row) {
              row -= inc;
              inc = -inc;
              break;
            }
          }
        }

        return modules;
      }

      function penalty(modules) {
        const size = modules.length;
        let score = 0;

        for (let row = 0; row < size; row++) {
          for (let col = 0; col < size; col++) {
            let same = 0;
            const dark = modules[row][col];

            for (let r = -1; r <= 1; r++) {
              if (row + r < 0 || size <= row + r) continue;
              for (let c = -1; c <= 1; c++) {
                if (col + c < 0 || size <= col + c) continue;
                if (r === 0 && c === 0) continue;
                if (dark === modules[row + r][col + c]) same++;
              }
            }

            if (same > 5) score += 3 + same - 5;
          }
        }

        for (let row = 0; row < size - 1; row++) {
          for (let col = 0; col < size - 1; col++) {
            let dark = 0;
            if (modules[row][col]) dark++;
            if (modules[row + 1][col]) dark++;
            if (modules[row][col + 1]) dark++;
            if (modules[row + 1][col + 1]) dark++;
            if (dark === 0 || dark === 4) score += 3;
          }
        }

        for (let row = 0; row < size; row++) {
          for (let col = 0; col < size - 6; col++) {
            if (modules[row][col] && !modules[row][col + 1] && modules[row][col + 2] &&
                modules[row][col + 3] && modules[row][col + 4] && !modules[row][col + 5] &&
                modules[row][col + 6]) score += 40;
          }
        }

        for (let col = 0; col < size; col++) {
          for (let row = 0; row < size - 6; row++) {
            if (modules[row][col] && !modules[row + 1][col] && modules[row + 2][col] &&
                modules[row + 3][col] && modules[row + 4][col] && !modules[row + 5][col] &&
                modules[row + 6][col]) score += 40;
          }
        }

        let darkCount = 0;
        for (let col = 0; col < size; col++) {
          for (let row = 0; row < size; row++) {
            if (modules[row][col]) darkCount++;
          }
        }

        const ratio = Math.abs((darkCount * 100) / (size * size) - 50) / 5;
        return score + ratio * 10;
      }

      function utf8Bytes(text) {
        return Array.from(new TextEncoder().encode(text));
      }

      function encodeQr(content, level = "H") {
        const bytes = utf8Bytes(content);
        const version = smallestVersion(bytes.length, level);
        const codewords = interleave(encodeData(bytes, version, level), version, level);

        let best = null;
        let bestScore = Infinity;

        for (let pattern = 0; pattern < 8; pattern++) {
          const score = penalty(buildMatrix(version, level, codewords, pattern, true));

          if (score < bestScore) {
            bestScore = score;
            best = pattern;
          }
        }

        return { version, level, modules: buildMatrix(version, level, codewords, best, false), mask: best };
      }


window.RRQR = { encode: function (content) { return encodeQr(content).modules }, svg: qrCodeSvg, png: qrCodePng, quietZone: QR_QUIET_ZONE };
})();
