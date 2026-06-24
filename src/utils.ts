export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function encodePCMToWAV(pcmBuffer: ArrayBuffer, sampleRate: number = 24000): Blob {
  const buffer = new ArrayBuffer(44 + pcmBuffer.byteLength);
  const view = new DataView(buffer);

  // 1. "RIFF"
  writeString(view, 0, "RIFF");
  // 2. File size minus 8 bytes
  view.setUint32(4, 36 + pcmBuffer.byteLength, true);
  // 3. "WAVE"
  writeString(view, 8, "WAVE");
  // 4. "fmt " chunk
  writeString(view, 12, "fmt ");
  // 5. Chunk size (16)
  view.setUint32(16, 16, true);
  // 6. Audio format (1 = PCM uncompressed)
  view.setUint16(20, 1, true);
  // 7. Channels (1 = Mono)
  view.setUint16(22, 1, true);
  // 8. Sample Rate
  view.setUint32(24, sampleRate, true);
  // 9. Byte Rate (SampleRate * Channels * BitsPerSample/8)
  view.setUint32(28, sampleRate * 1 * (16 / 8), true);
  // 10. Block Align (Channels * BitsPerSample/8)
  view.setUint16(32, 1 * (16 / 8), true);
  // 11. Bits per sample (16 bits)
  view.setUint16(34, 16, true);
  // 12. "data" chunk
  writeString(view, 36, "data");
  // 13. Chunk size
  view.setUint32(40, pcmBuffer.byteLength, true);

  // Copy raw PCM data to buffer starting at offset 44
  const src = new Uint8Array(pcmBuffer);
  const dst = new Uint8Array(buffer, 44);
  dst.set(src);

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch (e) {
    return dateString;
  }
}
