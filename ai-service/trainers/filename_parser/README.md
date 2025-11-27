# Filename Parser Training System

This module provides a complete training system for parsing audio filenames into structured metadata using machine learning.

## Features

- **Data Augmentation**: Generates variations of filenames to expand training datasets
- **Model Training**: Trains machine learning models to parse filenames
- **Hybrid Parser**: Combines regex and ML approaches for robust parsing
- **Easy Integration**: Simple API for training and using the parser

## Quick Start

### 1. Create Sample Dataset

```bash
cd ai-service/trainers/filename_parser
python train.py --create-sample
```

### 2. Train Model

```bash
python train.py --input-csv sample_dataset.csv --output-dir trained_model
```

### 3. Use Trained Model

```python
from hybrid_parser import HybridFilenameParser

parser = HybridFilenameParser('trained_model')
result = parser.parse("Artist - Song (2023).mp3")
print(result)
```

## Data Augmentation

The system automatically generates variations of your training data:

- **Separator Variations**: `-`, `–`, `—`, `~`, `:`
- **Spacing Changes**: Add/remove spaces around separators
- **Case Variations**: lowercase, UPPERCASE, Title Case, random case
- **File Extensions**: `.mp3`, `.wav`, `.flac`, `.m4a`, `.aac`, `.opus`
- **Unicode Characters**: Emojis and special characters
- **Combinations**: Multiple augmentations applied together

## CSV Format

Your training CSV should have these columns:

```csv
filename,artist,title,year,label,subtitle
"Artist - Title.mp3","Artist","Title","","",""
"Band – Song (1999).mp3","Band","Song","1999","",""
```

## Training Pipeline

1. **Load CSV**: Read your training data
2. **Augment Data**: Generate variations (10x+ expansion)
3. **Train Models**: Separate models for each field
4. **Save Model**: Persist trained models
5. **Test Parser**: Validate performance

## Integration

The hybrid parser can be integrated with your existing regex-based parser:

```python
# Try regex first (fast)
regex_result = parse_with_regex(filename)

# If regex fails, use ML model
if not regex_result['artist'] or not regex_result['title']:
    ml_result = ml_model.predict(filename)
    return ml_result

return regex_result
```

## Performance

- **Regex**: Fast, handles common patterns
- **ML Model**: Slower, handles edge cases
- **Hybrid**: Best of both worlds

## Requirements

```bash
pip install -r requirements.txt
```

## Examples

### Basic Training

```bash
python train.py --input-csv my_data.csv --output-dir my_model
```

### With Custom Augmented Dataset

```bash
python train.py --input-csv my_data.csv --augmented-csv augmented.csv --output-dir my_model
```

### Test Sample Creation

```bash
python train.py --create-sample
```
