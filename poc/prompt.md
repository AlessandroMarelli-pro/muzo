## 📝 **Task Prompt: Create Personal Music Dataset**

### **Context**

We've identified that the current model predicts "classical" for all personal music files because there's a **massive feature mismatch** between GTZAN training data (60 features) and personal music files (14 features). Only 1 feature overlaps, causing the model to fail.

### **Objective**

Create a properly labeled personal music dataset to train a domain-specific model that will work accurately on your actual music collection.

### **Required Steps**

#### **Step 1: Organize Music Files**

```bash
# Create genre folder structure
mkdir -p /Users/alessandro/Music/personal_dataset/{electronic,hiphop,rock,jazz,pop,metal,country,blues,reggae,disco}

# Move files from /Users/alessandro/Music/tidal/Tracks/ to appropriate genre folders
# Example:
# mv "/Users/alessandro/Music/tidal/Tracks/DAVID AUGUST - WORKOUT II.flac" /Users/alessandro/Music/personal_dataset/electronic/
# mv "/Users/alessandro/Music/tidal/Tracks/Gene On Earth - Pinseeker.flac" /Users/alessandro/Music/personal_dataset/electronic/
# etc.
```

#### **Step 2: Run Dataset Creation Script**

```bash
cd /Users/alessandro/dev/cursor-dev/muzo/poc
python3 scripts/create_personal_dataset.py --input /Users/alessandro/Music/personal_dataset --output data/personal_features.csv
```

#### **Step 3: Train New Model**

```bash
# Train model on personal dataset
python3 src/model_training.py --features data/personal_features.csv --output models --model-name personal-v1.0
```

#### **Step 4: Validate Performance**

```bash
# Test the new model on personal music
python3 tests/simple_personal_validation.py
```

### **Expected Results**

- ✅ **Realistic genre predictions** instead of "classical" bias
- ✅ **High accuracy** (80%+) on your personal music
- ✅ **Proper confidence scores** reflecting actual prediction certainty
- ✅ **Domain-specific model** trained on your actual music

### **Files Created**

- `poc/scripts/create_personal_dataset.py` - Dataset creation script
- `poc/tests/feature_comparison.py` - Feature analysis script
- `data/personal_features.csv` - Labeled personal music dataset
- `models/personal-v1.0.pkl` - Trained model on personal data

### **Current Status**

- ✅ Feature mismatch analysis completed
- ✅ Dataset creation script ready
- ⏳ **NEXT**: Organize music files into genre folders
- ⏳ **THEN**: Run dataset creation and train new model

### **Resume Command**

When ready to continue, run:

```bash
cd /Users/alessandro/dev/cursor-dev/muzo/poc
python3 scripts/create_personal_dataset.py --input /Users/alessandro/Music/personal_dataset --output data/personal_features.csv
```
