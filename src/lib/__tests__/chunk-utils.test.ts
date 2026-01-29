import {
  calculateHash,
  splitFileIntoChunks,
  getOptimalChunkSize,
  getOptimalConcurrency,
  calculateExpectedUploadTime,
} from '../chunk-utils';

describe('Chunk Utils', () => {
  describe('getOptimalChunkSize', () => {
    it('should return 1MB for files < 5MB', () => {
      expect(getOptimalChunkSize(2 * 1024 * 1024)).toBe(1 * 1024 * 1024);
    });

    it('should return 5MB for files 5-50MB', () => {
      expect(getOptimalChunkSize(20 * 1024 * 1024)).toBe(5 * 1024 * 1024);
    });

    it('should return 10MB for files > 50MB', () => {
      expect(getOptimalChunkSize(100 * 1024 * 1024)).toBe(10 * 1024 * 1024);
    });
  });

  describe('getOptimalConcurrency', () => {
    it('should return 2 for small files', () => {
      expect(getOptimalConcurrency(2 * 1024 * 1024)).toBe(2);
    });

    it('should return 3 for medium files (20MB)', () => {
      expect(getOptimalConcurrency(20 * 1024 * 1024)).toBe(3);
    });

    it('should return 4 for large files', () => {
      expect(getOptimalConcurrency(75 * 1024 * 1024)).toBe(4);
    });

    it('should return 6 for very large files', () => {
      expect(getOptimalConcurrency(150 * 1024 * 1024)).toBe(6);
    });
  });

  describe('splitFileIntoChunks', () => {
    it('should split file into correct number of chunks', () => {
      const file = new File(['x'.repeat(10 * 1024 * 1024)], 'test.txt', {
        type: 'text/plain',
      });
      const chunkSize = 5 * 1024 * 1024; // 5MB
      const chunks = Array.from(splitFileIntoChunks(file, chunkSize));

      expect(chunks.length).toBe(2);
      expect(chunks[0].chunk.size).toBe(5 * 1024 * 1024);
      expect(chunks[0].index).toBe(0);
    });
  });

  describe('calculateExpectedUploadTime', () => {
    it('should calculate upload time correctly', () => {
      const fileSize = 20 * 1024 * 1024; // 20MB
      const chunks = 4;
      const concurrency = 3;
      const uploadSpeedMbps = 10;

      const time = calculateExpectedUploadTime(fileSize, chunks, concurrency, uploadSpeedMbps);

      // 20MB @ 10Mbps = 20 * 8 / 10 = 16 seconds
      expect(time).toBeGreaterThan(0);
      expect(time).toBeLessThan(30);
    });
  });
});
