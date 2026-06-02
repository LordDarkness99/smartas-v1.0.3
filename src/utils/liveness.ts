// src/utils/liveness.ts
import * as faceapi from "face-api.js";

/**
 * Mendeteksi apakah pengguna tersenyum (ekspresi happy)
 * @param videoEl Elemen video
 * @param timeoutMs Batas waktu maksimal (ms)
 * @param threshold Ambang batas skor happy (0-1), default 0.7
 * @returns Promise<boolean> true jika senyum terdeteksi dalam batas waktu
 */
export async function detectSmile(
  videoEl: HTMLVideoElement,
  timeoutMs: number = 7000,
  threshold: number = 0.7
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    // Cek apakah model expression sudah di-load (seperti validasi awal)
    if (!faceapi.nets.faceExpressionNet?.isLoaded) {
      const errorMsg = "FaceExpressionNet belum di-load. Panggil await faceapi.nets.faceExpressionNet.loadFromUri('/models') terlebih dahulu.";
      console.error(errorMsg);
      reject(new Error(errorMsg));
      return;
    }

    let smileDetected = false;
    let intervalId: number | undefined;

    const checkSmile = async () => {
      if (!videoEl || videoEl.readyState !== 4) return;

      try {
        // Deteksi wajah + landmark + ekspresi (mirip dengan aslinya yang pakai .withFaceLandmarks)
        const detection = await faceapi
          .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions();

        if (!detection) return;

        const happyScore = detection.expressions.happy;
        console.log(`Skor senyum (happy): ${happyScore.toFixed(3)}`);

        if (happyScore >= threshold) {
          console.log(`✅ Senyum terdeteksi! (skor=${happyScore.toFixed(3)})`);
          smileDetected = true;
          if (intervalId) clearInterval(intervalId);
          resolve(true);
        }
      } catch (err) {
        console.warn("Error deteksi senyum:", err);
      }
    };

    intervalId = window.setInterval(checkSmile, 100); // cek setiap 100ms

    setTimeout(() => {
      if (intervalId) clearInterval(intervalId);
      if (!smileDetected) {
        console.log(`❌ Timeout, tidak ada senyum terdeteksi dalam ${timeoutMs}ms`);
        resolve(false);
      }
    }, timeoutMs);
  });
}