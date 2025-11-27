# upload_subgenre_specialists.py
from huggingface_hub import HfApi
import os
from pathlib import Path

def upload_subgenre_specialists():
    api = HfApi(token=os.getenv("HF_TOKEN"))
    
    specialists_dir = Path("models/subgenre_specialists")
    
    for genre_dir in specialists_dir.iterdir():
        if not genre_dir.is_dir():
            continue
            
        genre_name = genre_dir.name
        print(f"📤 Uploading {genre_name} specialist...")
        
        # Find model file
        model_files = list(genre_dir.glob("*.pth"))
        results_files = list(genre_dir.glob("*_results.json"))
        
        if model_files:
            model_path = model_files[0]
            api.upload_file(
                path_or_fileobj=str(model_path),
                path_in_repo=f"{genre_name.lower()}_specialist.pth",
                repo_id="CosmicSurfer/muzo-subgenre-specialists",
                repo_type="model"
            )
            print(f"  ✅ {genre_name} model uploaded")
        
        if results_files:
            results_path = results_files[0]
            api.upload_file(
                path_or_fileobj=str(results_path),
                path_in_repo=f"{genre_name.lower()}_results.json",
                repo_id="CosmicSurfer/muzo-subgenre-specialists",
                repo_type="model"
            )
            print(f"  ✅ {genre_name} results uploaded")

if __name__ == "__main__":
    upload_subgenre_specialists()