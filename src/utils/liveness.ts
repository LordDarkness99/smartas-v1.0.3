// src/utils/liveness.ts
import * as faceapi from "face-api.js";

/**
 * Mendeteksi gerakan menoleh ke kanan atau kiri
 * @param videoEl Elemen video
 * @param direction 'kanan' atau 'kiri'
 * @param timeoutMs Batas waktu maksimal (ms)
 * @returns Promise<boolean> true jika gerakan terdeteksi
 */
export async function detectTurnHead(
  videoEl: HTMLVideoElement,
  direction: 'kanan' | 'kiri',
  timeoutMs: number = 7000
): Promise<boolean> {
  return new Promise((resolve) => {
    let startYaw: number | null = null;
    let gestureDetected = false;
    let intervalId: number | undefined;

    const checkTurn = async () => {
      if (!videoEl || videoEl.readyState !== 4) return;
      try {
        const detection = await faceapi
          .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks();
        if (!detection) return;

        // Ambil landmark pipi kiri dan kanan (indeks 0 dan 16 dari jaw outline)
        const jaw = detection.landmarks.getJawOutline();
        const leftCheek = jaw[0];
        const rightCheek = jaw[16];
        const faceWidth = rightCheek.x - leftCheek.x;

        // Ambil titik hidung (index 0 dari nose)
        const nose = detection.landmarks.getNose();
        const noseX = nose[0].x;

        // Hitung posisi relatif hidung (0 = kiri, 1 = kanan)
        let noseRatio = (noseX - leftCheek.x) / faceWidth;
        // Batasi nilai antara 0 dan 1
        noseRatio = Math.min(1, Math.max(0, noseRatio));

        // Konversi ke yaw: 0.5 = lurus, <0.45 = kiri, >0.55 = kanan
        const yaw = (noseRatio - 0.5) * 2; // range -1 (kiri) ke 1 (kanan)

        if (startYaw === null) {
          // Rekam posisi awal (harus wajah lurus, antara -0.2 sampai 0.2)
          if (Math.abs(yaw) < 0.2) {
            startYaw = yaw;
            console.log(`Posisi awal wajah lurus terdeteksi: yaw=${yaw.toFixed(3)}`);
          }
          return;
        }

        // Hitung perubahan yaw dari posisi awal
        const delta = yaw - startYaw;
        console.log(`yaw=${yaw.toFixed(3)}, delta=${delta.toFixed(3)}`);

        if (direction === 'kanan' && delta > 0.35) {
          console.log(`✅ Menoleh ke kanan terdeteksi (delta=${delta.toFixed(3)})`);
          gestureDetected = true;
          if (intervalId) clearInterval(intervalId);
          resolve(true);
        } else if (direction === 'kiri' && delta < -0.35) {
          console.log(`✅ Menoleh ke kiri terdeteksi (delta=${delta.toFixed(3)})`);
          gestureDetected = true;
          if (intervalId) clearInterval(intervalId);
          resolve(true);
        }
      } catch (err) {
        console.warn("Error deteksi menoleh:", err);
      }
    };

    intervalId = window.setInterval(checkTurn, 100);
    setTimeout(() => {
      if (intervalId) clearInterval(intervalId);
      if (!gestureDetected) {
        console.log(`❌ Timeout, tidak terdeteksi menoleh ke ${direction}`);
        resolve(false);
      }
    }, timeoutMs);
  });
}