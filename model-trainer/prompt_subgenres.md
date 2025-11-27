# 📝 **Task Prompt: Create Personal Music Dataset with Subgenres**

## **Context**

We've identified that the current model predicts "classical" for all personal music files because there's a **massive feature mismatch** between GTZAN training data (60 features) and personal music files (14 features). Only 1 feature overlaps, causing the model to fail.

## **Objective**

Create a properly labeled personal music dataset with **genre and subgenre classification** to train a domain-specific model that will work accurately on your actual music collection.

## **Required Steps**

### **Step 1: Organize Music Files with Subgenres**

```bash
# Create genre/subgenre folder structure
mkdir -p /Users/alessandro/Music/personal_dataset/electronic/{idm,ebm,dubstep}
mkdir -p /Users/alessandro/Music/personal_dataset/rock/{alternative,metal,punk}
mkdir -p /Users/alessandro/Music/personal_dataset/hiphop/{old_school,conscious}
mkdir -p /Users/alessandro/Music/personal_dataset/jazz/{smooth,acid_jazz}
mkdir -p /Users/alessandro/Music/personal_dataset/pop/{synthpop,indie_pop,electropop}
mkdir -p /Users/alessandro/Music/personal_dataset/metal/{death,black,thrash,progressive}
mkdir -p /Users/alessandro/Music/personal_dataset/country/{country_rock,bluegrass,alt_country}
mkdir -p /Users/alessandro/Music/personal_dataset/blues/{delta,chicago,electric}
mkdir -p /Users/alessandro/Music/personal_dataset/reggae/{roots,dancehall}
mkdir -p /Users/alessandro/Music/personal_dataset/disco/{italo,nu_disco,space_disco}

# Move files from /Users/alessandro/Music/tidal/Tracks/ to appropriate subgenre folders
# Example:
# mv "/Users/alessandro/Music/tidal/Tracks/DAVID AUGUST - WORKOUT II.flac" /Users/alessandro/Music/personal_dataset/electronic/house/
# mv "/Users/alessandro/Music/tidal/Tracks/Gene On Earth - Pinseeker.flac" /Users/alessandro/Music/personal_dataset/electronic/techno/
# etc.
```

### **Step 2: Run Dataset Creation Script**

```bash
cd /Users/alessandro/dev/cursor-dev/muzo/poc

# With subgenres (default)
python3 scripts/regenerate_personal_format.py --input /Users/alessandro/Music/personal_dataset --output data/personal_features_subgenres.csv

# Without subgenres (genre-only)
python3 scripts/create_personal_dataset.py --input /Users/alessandro/Music/personal_dataset --output data/personal_features_genres.csv --no-subgenres
```

### **Step 3: Train New Models**

```bash
# Train model on subgenre dataset
python3 src/model_training.py --features data/personal_features_subgenres.csv --output models --model-name personal-subgenres-v1.0

# Train model on genre-only dataset
python3 src/model_training.py --features data/personal_features_genres.csv --output models --model-name personal-genres-v1.0
```

### **Step 4: Validate Performance**

```bash
# Test the subgenre model
python3 tests/simple_personal_validation.py

# Compare both models
python3 tests/feature_comparison.py
```

## **Expected Results**

### **With Subgenres** 🎶

- ✅ **Granular classification**: electronic_techno, electronic_trance, etc.
- ✅ **Higher precision**: More specific genre identification
- ✅ **Better organization**: Detailed music categorization
- ✅ **More classes**: 20-50+ subgenre classes vs 10 genre classes

### **With Genres Only** 🎵

- ✅ **Broader classification**: electronic, rock, hiphop, etc.
- ✅ **Higher recall**: Easier to classify correctly
- ✅ **Simpler structure**: 10-15 genre classes
- ✅ **Faster training**: Fewer classes to learn

## **Dataset Structure**

### **Subgenre Dataset Columns**

- `genre`: Main genre (electronic, rock, etc.)
- `subgenre`: Subgenre (techno, trance, etc.)
- `label`: Combined label (electronic_techno, rock_metal, etc.)
- `filename`: Original filename
- `file_path`: Full path to file
- `dataset`: "personal"
- `extraction_date`: Timestamp

### **Genre Dataset Columns**

- `genre`: Main genre (electronic, rock, etc.)
- `subgenre`: None
- `label`: Genre only (electronic, rock, etc.)
- `filename`: Original filename
- `file_path`: Full path to file
- `dataset`: "personal"
- `extraction_date`: Timestamp

## **Files Created**

- `poc/scripts/create_personal_dataset.py` - Updated dataset creation script
- `data/personal_features_subgenres.csv` - Subgenre-labeled dataset
- `data/personal_features_genres.csv` - Genre-only dataset
- `models/personal-subgenres-v1.0.pkl` - Subgenre model
- `models/personal-genres-v1.0.pkl` - Genre model

## **Current Status**

- ✅ Feature mismatch analysis completed
- ✅ Dataset creation script updated for subgenres
- ✅ Both genre and subgenre options available
- ⏳ **NEXT**: Organize music files into genre/subgenre folders
- ⏳ **THEN**: Run dataset creation and train models

## **Resume Commands**

### **With Subgenres**

```bash
cd /Users/alessandro/dev/cursor-dev/muzo/poc
python3 scripts/create_personal_dataset.py --input /Users/alessandro/Music/personal_dataset --output data/personal_features_subgenres.csv
```

### **Genre-Only**

```bash
cd /Users/alessandro/dev/cursor-dev/muzo/poc
python3 scripts/create_personal_dataset.py --input /Users/alessandro/Music/personal_dataset --output data/personal_features_genres.csv --no-subgenres
```

## **Benefits of Subgenres**

1. **More Precise Classification**: Distinguish between techno and trance
2. **Better Music Organization**: Detailed categorization
3. **Higher User Value**: More specific recommendations
4. **Flexible Hierarchy**: Can aggregate to genres when needed
5. **Future-Proof**: Easy to add new subgenres

---

**Save this prompt and come back to it when you're ready to organize your music files with subgenres!** The scripts now support both genre-only and subgenre classification.
