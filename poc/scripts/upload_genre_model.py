from huggingface_hub import HfApi, Repository
import os

def upload_genre_classifier():
    api = HfApi(token=os.getenv("HF_TOKEN"))
    
    # Upload the main genre classifier
    model_path = "models/final_optimized_7genres/final_optimized_7genres-v1.0.pth"
    results_path = "models/final_optimized_7genres/final_optimized_7genres-v1.0_results.json"
    
    if os.path.exists(model_path):
        api.upload_file(
            path_or_fileobj=model_path,
            path_in_repo="genre_classifier.pth",
            repo_id="CosmicSurfer/muzo-genre-classifier",
            repo_type="model"
        )
        print("✅ Genre classifier uploaded!")
    
    if os.path.exists(results_path):
        api.upload_file(
            path_or_fileobj=results_path,
            path_in_repo="training_results.json",
            repo_id="CosmicSurfer/muzo-genre-classifier",
            repo_type="model"
        )
        print("✅ Training results uploaded!")

if __name__ == "__main__":
    upload_genre_classifier()