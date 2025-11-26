# This script trains CNN models for music genre classification

# Set error action preference
$ErrorActionPreference = "Stop"

# Function to run Python command with error handling
function Invoke-PythonTraining {
    param(
        [string]$ScriptPath,
        [string]$Arguments
    )
    
    try {
        Write-Host "Executing: python $ScriptPath $Arguments" -ForegroundColor Green
        python $ScriptPath $Arguments.Split(' ')
        if ($LASTEXITCODE -ne 0) {
            throw "Python script failed with exit code $LASTEXITCODE"
        }
        Write-Host "Command completed successfully" -ForegroundColor Green
    }
    catch {
        Write-Error "Failed to execute Python command: $_"
        exit 1
    }
}

# Main training commands
Write-Host "Starting CNN model training..." -ForegroundColor Cyan

# First training command - main genre classification
Write-Host "`nTraining main genre classification model..." -ForegroundColor Yellow
Invoke-PythonTraining -ScriptPath "src\cnn_model_training.py" -Arguments '--dataset "C:\Users\Alessandro\dev\muzo\dataset" --output "models\final_optimized_7genres_v2" --model-name final_optimized_7genres-v2.0 --architecture hybrid --use-preprocessing --target-samples 1500 --segment-duration 90 --epochs 8 --lr 0.0001 --batch-size 8 --workers 8 --val-split 0.2 --genre-only'

# Second training command - subgenre classification
Write-Host "`nTraining subgenre classification model..." -ForegroundColor Yellow
Invoke-PythonTraining -ScriptPath "src\cnn_model_training_subgenre.py" -Arguments '--dataset "C:\Users\Alessandro\dev\muzo\dataset" --output "models\subgenre_specialists_v2" --architecture hybrid --target-samples 1000 --segment-duration 90 --epochs 8 --lr 0.0001 --batch-size 8 --workers 8 --val-split 0.2 --genres "Alternative,Dance_EDM,Electronic,Hip-Hop_Rap,Jazz,R&B_Soul,Reggae"'

Write-Host "`nAll training completed successfully!" -ForegroundColor Green
