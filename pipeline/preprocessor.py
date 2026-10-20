"""
Image pre-processing module for CityEye AI pipeline.
Applies CLAHE (Contrast Limited Adaptive Histogram Equalization) on the Luminance (L) channel
in LAB color space to dramatically enhance defect edge definition in low-contrast CCTV streams.
"""
import cv2
import numpy as np

def apply_clahe_enhancement(
    frame: np.ndarray,
    clip_limit: float = 2.0,
    tile_grid_size: tuple[int, int] = (8, 8)
) -> np.ndarray:
    """
    Enhances contrast while preserving natural color by working in LAB space.
    L-channel: Lightness/Luminance (enhanced via CLAHE)
    A/B-channels: Color information (preserved untouched)
    """
    if frame is None or frame.size == 0:
        return frame

    # Convert BGR to LAB color space
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    # Apply CLAHE only to Lightness channel
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    enhanced_l = clahe.apply(l_channel)

    # Merge channels back and convert back to BGR
    enhanced_lab = cv2.merge((enhanced_l, a_channel, b_channel))
    enhanced_bgr = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
    return enhanced_bgr
