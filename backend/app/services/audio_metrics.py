"""
محلل الخصائص الصوتية الفيزيائية باستخدام PyAV (Audio Acoustic Metrics — Section 7.1).

يستخلص مدة الصوت الحقيقية، نسبة الصمت والتوقفات (silence_ratio / pause_count)،
ومستوى/استقرار الطاقة الصوتية (rms_db / energy_stability) مباشرة من البث الصوتي دون
الحاجة لثنائي ffmpeg خارجي.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from io import BytesIO
from typing import Optional

logger = logging.getLogger("career_compass.audio_metrics")

MAX_AUDIO_SAMPLE_RATE = 16000
MAX_DECODED_SECONDS = 180
MAX_DECODED_SAMPLES = MAX_AUDIO_SAMPLE_RATE * MAX_DECODED_SECONDS
MAX_DECODED_FRAMES = MAX_DECODED_SECONDS * 200


@dataclass(frozen=True)
class AcousticMetrics:
    decoded_duration_seconds: float
    silence_ratio: float
    pause_count: int
    rms_db: float
    energy_stability: float


def extract_acoustic_metrics(audio_bytes: bytes) -> Optional[AcousticMetrics]:
    """Decodes uploaded audio buffer into 16kHz mono float samples via PyAV and computes acoustic stats."""
    if not audio_bytes or len(audio_bytes) < 64:
        return None

    try:
        import av
        import numpy as np
    except ImportError:
        return None

    container = None
    try:
        container = av.open(BytesIO(audio_bytes))
        audio_stream = next((s for s in container.streams if s.type == "audio"), None)
        if audio_stream is None:
            return None

        resampler = av.AudioResampler(format="flt", layout="mono", rate=MAX_AUDIO_SAMPLE_RATE)
        chunks = []
        collected_samples = 0
        frame_count = 0
        cap_reached = False

        def _append_resampled(resampled_item) -> bool:
            nonlocal collected_samples
            resampled_list = resampled_item if isinstance(resampled_item, list) else [resampled_item]
            for r_frame in resampled_list:
                if r_frame is None:
                    continue
                arr = r_frame.to_ndarray().reshape(-1).astype(np.float32)
                if arr.size <= 0:
                    continue
                remaining = MAX_DECODED_SAMPLES - collected_samples
                if remaining <= 0:
                    return True
                if arr.size >= remaining:
                    chunks.append(arr[:remaining])
                    collected_samples += remaining
                    return True
                chunks.append(arr)
                collected_samples += int(arr.size)
            return False

        for frame in container.decode(audio_stream):
            frame_count += 1
            if frame_count > MAX_DECODED_FRAMES:
                cap_reached = True
                break
            if _append_resampled(resampler.resample(frame)):
                cap_reached = True
                break

        if not cap_reached:
            flushed = resampler.resample(None)
            if flushed is not None:
                _append_resampled(flushed)

        if not chunks:
            return None

        samples = np.concatenate(chunks)
        total_samples = int(samples.size)
        duration_sec = total_samples / 16000.0
        if duration_sec < 0.2:
            return None

        overall_rms = float(np.sqrt(np.mean(np.square(samples))))
        rms_db = round(20.0 * math.log10(max(overall_rms, 1e-6)), 1)

        # تقسيم الإشارة إلى نوافذ 20ms (320 عينة عند 16kHz) لحساب فترات الصمت واستقرار الصوت
        win_size = 320
        usable = (total_samples // win_size) * win_size
        if usable < win_size:
            return AcousticMetrics(
                decoded_duration_seconds=round(duration_sec, 2),
                silence_ratio=0.0 if overall_rms > 0.008 else 1.0,
                pause_count=0,
                rms_db=rms_db,
                energy_stability=0.7 if overall_rms > 0.008 else 0.0,
            )

        windows = samples[:usable].reshape(-1, win_size)
        win_rms = np.sqrt(np.mean(np.square(windows), axis=1))
        median_rms = float(np.median(win_rms))
        noise_floor = max(0.006, median_rms * 0.28)
        silent_mask = win_rms < noise_floor

        silence_ratio = round(float(np.mean(silent_mask)), 3)

        # عدّ الوقفات الطويلة المتصلة (>= 20 نافذة = >= 0.4 ثانية) بعد تجاهل صمت البداية/النهاية القصير
        pause_count = 0
        run_len = 0
        saw_speech = False
        for is_sil in silent_mask:
            if not is_sil:
                if saw_speech and run_len >= 20:
                    pause_count += 1
                saw_speech = True
                run_len = 0
            else:
                if saw_speech:
                    run_len += 1

        speech_rms = win_rms[~silent_mask]
        if speech_rms.size >= 3:
            mean_sp = float(np.mean(speech_rms))
            std_sp = float(np.std(speech_rms))
            cv = std_sp / max(mean_sp, 1e-5)
            energy_stability = round(max(0.0, min(1.0, 1.0 - (cv * 0.55))), 3)
        elif overall_rms > 0.008:
            energy_stability = 0.65
        else:
            energy_stability = 0.0

        return AcousticMetrics(
            decoded_duration_seconds=round(duration_sec, 2),
            silence_ratio=silence_ratio,
            pause_count=pause_count,
            rms_db=rms_db,
            energy_stability=energy_stability,
        )
    except Exception as exc:
        logger.debug("Acoustic metrics extraction skipped (%s)", exc)
        return None
    finally:
        if container is not None:
            try:
                container.close()
            except Exception:
                pass
