# 👁️ CityEye — Municipal AI Computer Vision & Defect Detection

> Real-time Automated Infrastructure Monitoring using YOLOv8, CLAHE Low-Light Preprocessing, Temporal Multi-Frame Verification, and Severity Scoring for Municipal Civic Bodies.

---

## 📌 Overview

**CityEye AI** is the core computer vision and machine learning engine designed for smart city municipal corporations. It ingests video feeds from street-level CCTV cameras and automatically identifies civic infrastructure defects with zero human fatigue:
* 🕳️ **Potholes & Road Cracks** (Structural pavement degradation)
* 🗑️ **Garbage Dumps & Waste Accumulation** (Sanitation hazards)
* 💧 **Waterlogging & Blocked Drains** (Monsoon/flooding bottlenecks)

---

## 🚀 Key AI Features

1. **YOLOv8 Real-Time Inference**: High-accuracy object detection tuned for urban street imagery.
2. **CLAHE Low-Light & Rain Preprocessing**: Contrast Limited Adaptive Histogram Equalization enhances nighttime, monsoon, and shadow frames before detection.
3. **Temporal Multi-Frame Confirmation (Anti-False-Positive Filter)**:
   * Tracks defect candidate bounding boxes across continuous temporal frames.
   * Requires consistent spatial IoU overlap across consecutive frames before confirming a defect.
   * Eliminates false alarms caused by moving vehicle shadows, pedestrians, or temporary reflections.
4. **Automated Severity Scoring**: Computes hazard severity (Low, Medium, High) based on relative defect surface area and detection confidence.
5. **Pre-Trained Weights**: Includes pre-trained YOLOv8 weights deployed in `models/best.pt`.

---

## 📂 Repository Structure

```
CityEye/
├── models/
│   └── best.pt                  # Pre-trained YOLOv8 municipal defect detection model
├── inference/
│   └── detect.py                # Live stream/video detection with temporal verification
├── pipeline/
│   ├── verifier.py              # Multi-frame IoU tracking & confirmation logic
│   ├── severity.py              # Defect severity scoring engine
│   ├── preprocessor.py          # CLAHE contrast & low-light image enhancement
│   └── complaint_generator.py   # Automated civic ticket payload formatter
├── training/
│   ├── train.py                 # Fine-tuning & training script for custom datasets
│   └── config.yaml              # Dataset configuration schema
├── sample_videos/
│   └── generate_test_video.py   # Synthetic video test-stream generator
├── requirements.txt             # Python dependencies
└── README.md                    # Documentation
```

---

## 🛠️ Quickstart Installation

### 1. Clone the Repository
```bash
git clone https://github.com/dipeshkewat/CityEye.git
cd CityEye
```

### 2. Set Up Virtual Environment
```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

---

## 🎯 Running Inference

### Run Defect Simulation & Verification
```bash
python inference/detect.py --defect pothole
```

### Run Inference on a Custom Video
```bash
python inference/detect.py --source path/to/cctv_stream.mp4
```

---

## 🏋️ Model Training & Fine-Tuning

To train or fine-tune the model on your municipal dataset:
```bash
python training/train.py --epochs 25 --batch 16 --imgsz 640 --data training/config.yaml
```

The script automatically saves checkpoint weights to `training/runs/` and updates `models/best.pt` with the best-performing model.

---

## 📄 License
MIT License. Developed by [Dipesh Kewat](https://github.com/dipeshkewat).
