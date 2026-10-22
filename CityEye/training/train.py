"""
CityEye Model Training / Fine-Tuning Script.
Fine-tunes YOLOv8 Nano on curated road defect datasets according to
CityEye Technical Specification Section 2 and Section 5.
"""
import os
import shutil
import argparse
from ultralytics import YOLO

DATASET_CONFIGS = {
    "potholes": r"F:\Projects\CITYEYE-Dipesh\ml\datasets\potholes\data.yaml",
    "road_damage": r"F:\Projects\CITYEYE-Dipesh\ml\datasets\road_damage\RDD.v8i.yolov8\data.yaml",
}

def train_model(
    epochs: int = 1,
    imgsz: int = 320,
    batch_size: int = 16,
    dataset_name: str = "potholes",
    base_model: str = "yolov8n.pt"
):
    current_dir = os.path.dirname(os.path.abspath(__file__))
    data_yaml = DATASET_CONFIGS.get(dataset_name, DATASET_CONFIGS["potholes"])

    print(f"=======================================================")
    print(f"[*] STARTING CITYEYE YOLOv8 MODEL TRAINING")
    print(f"[*] Dataset:         {dataset_name} ({data_yaml})")
    print(f"[*] Base Weights:    {base_model}")
    print(f"[*] Epochs:          {epochs}")
    print(f"[*] Batch Size:      {batch_size}")
    print(f"[*] Image Size:      {imgsz}px")
    print(f"=======================================================\n")

    model = YOLO(base_model)
    results = model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch_size,
        device="cpu",
        workers=2,
        project=os.path.join(current_dir, "runs"),
        name="cityeye_trained_model",
        exist_ok=True
    )

    run_best = os.path.join(current_dir, "runs", "cityeye_trained_model", "weights", "best.pt")
    target_weights = os.path.abspath(os.path.join(current_dir, "..", "models", "best.pt"))

    if os.path.exists(run_best):
        shutil.copy(run_best, target_weights)
        print(f"\n[OK] Deployed trained model weights to: {target_weights}")

    print("\n[OK] TRAINING PIPELINE COMPLETE!")
    return results

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train CityEye YOLOv8 Model")
    parser.add_argument("--epochs", type=int, default=1, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=320, help="Image resolution for fast CPU training")
    parser.add_argument("--dataset", type=str, default="potholes", help="Target dataset name")
    parser.add_argument("--data", type=str, default=None, help="Path to custom data.yaml")
    args = parser.parse_args()

    data_file = args.data if args.data else DATASET_CONFIGS.get(args.dataset, os.path.join(current_script_dir, "config.yaml"))
    train_model(epochs=args.epochs, batch_size=args.batch, imgsz=args.imgsz, dataset_name=data_file)
