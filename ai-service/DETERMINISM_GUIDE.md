# Determinism and Consistency Guide

This guide explains how to configure the metadata extractor for maximum consistency and deterministic outputs.

## Quick Start: Maximum Determinism

To get **almost identical results** for the same query, set these environment variables:

```bash
# For Gemini
export GEMINI_TEMPERATURE=0
export GEMINI_TOP_P=1.0
export GEMINI_TOP_K=1
export GEMINI_SEED=42  # Use any fixed integer

# For OpenAI
export OPENAI_TEMPERATURE=0
export OPENAI_TOP_P=1.0
export OPENAI_SEED=42  # Use any fixed integer
export OPENAI_FREQUENCY_PENALTY=0.0
export OPENAI_PRESENCE_PENALTY=0.0
```

## Parameters Explained

### Temperature
- **What it does**: Controls randomness in token selection
- **Range**: 0.0 to 2.0 (or model max)
- **For determinism**: Set to `0.0` (greedy decoding - always picks most likely token)
- **Default**: `0` (already set for maximum determinism)

### Top-P (Nucleus Sampling)
- **What it does**: Limits token selection to those whose cumulative probability ≤ top_p
- **Range**: 0.0 to 1.0
- **For determinism**: Set to `1.0` (consider all tokens) when temperature=0
- **Default**: `1.0`

### Top-K
- **What it does**: Limits selection to top K most likely tokens
- **Range**: 1 to vocabulary size
- **For determinism**: Set to `1` (only most likely token) when temperature=0
- **Default**: `1`

### Seed
- **What it does**: Initializes random number generator for reproducible outputs
- **Range**: Any integer
- **For determinism**: Use a **fixed integer** (e.g., `42`) for all requests
- **Default**: `None` (random each time)

### Frequency Penalty (OpenAI only)
- **What it does**: Reduces likelihood of repeating tokens
- **Range**: -2.0 to 2.0
- **For determinism**: Set to `0.0` (no penalty)
- **Default**: `0.0`

### Presence Penalty (OpenAI only)
- **What it does**: Reduces likelihood of introducing new topics
- **Range**: -2.0 to 2.0
- **For determinism**: Set to `0.0` (no penalty)
- **Default**: `0.0`

## Recommended Settings

### Maximum Determinism (Same Query → Same Result)
```bash
# Gemini
GEMINI_TEMPERATURE=0
GEMINI_TOP_P=1.0
GEMINI_TOP_K=1
GEMINI_SEED=42

# OpenAI
OPENAI_TEMPERATURE=0
OPENAI_TOP_P=1.0
OPENAI_SEED=42
OPENAI_FREQUENCY_PENALTY=0.0
OPENAI_PRESENCE_PENALTY=0.0
```

### Balanced (Slight Variation, Still Consistent)
```bash
# Gemini
GEMINI_TEMPERATURE=0.1
GEMINI_TOP_P=0.9
GEMINI_TOP_K=40
GEMINI_SEED=42

# OpenAI
OPENAI_TEMPERATURE=0.1
OPENAI_TOP_P=0.9
OPENAI_SEED=42
OPENAI_FREQUENCY_PENALTY=0.0
OPENAI_PRESENCE_PENALTY=0.0
```

## Important Notes

1. **Seed is Critical**: Without a fixed seed, even with temperature=0, you may get slight variations due to floating-point precision and model updates.

2. **Model Version Changes**: If the underlying model is updated, outputs may change even with identical parameters.

3. **URL Context Tool**: When URLs are fetched via the URL context tool, ensure the fetched content is consistent (same URLs, same content).

4. **Filename Cleaning**: The filename cleaning step uses temperature=0.0 for consistency, but results may still vary slightly if the model version changes.

5. **Structured Outputs**: Using `response_schema` (Gemini) or `response_format={"type": "json_object"}` (OpenAI) helps ensure consistent structure.

## Fine-Tuning Options

### 1. Parameter Tuning (Current Approach)
- **What**: Adjust inference parameters (temperature, top_p, etc.)
- **Pros**: Easy, no training needed, immediate results
- **Cons**: Limited by model's inherent variability
- **Best for**: Quick consistency improvements

### 2. Prompt Engineering
- **What**: Refine instructions and examples in prompts
- **Pros**: No code changes, works with any model
- **Cons**: Requires experimentation
- **Best for**: Improving accuracy and consistency of specific fields

### 3. Few-Shot Learning
- **What**: Include examples in the prompt showing desired output format
- **Pros**: Teaches model your expected format
- **Cons**: Increases token usage
- **Best for**: Teaching specific formatting or field extraction patterns

### 4. Model Fine-Tuning (Advanced)
- **What**: Train the model on your specific dataset
- **Pros**: Best consistency and accuracy for your use case
- **Cons**: Requires training data, compute resources, model access
- **Best for**: Production systems with large datasets

### Fine-Tuning Dataset Preparation

If you want to fine-tune a model:

1. **Collect Examples**:
   - Gather pairs of (input_filename, expected_metadata_json)
   - Include variations of the same track (different filenames → same metadata)
   - Include edge cases and ambiguous inputs

2. **Format for Training**:
   ```json
   {
     "messages": [
       {"role": "system", "content": "You are a music metadata expert..."},
       {"role": "user", "content": "Extract metadata from: T-Fire - Say A Prayer"},
       {"role": "assistant", "content": "{\"artist\": \"T-Fire\", \"title\": \"Say A Prayer\", ...}"}
     ]
   }
   ```

3. **Training Process**:
   - Use provider's fine-tuning API (OpenAI Fine-tuning, Google Vertex AI, etc.)
   - Train on your dataset
   - Evaluate on test set
   - Deploy fine-tuned model

## Testing Consistency

To verify your settings work:

```python
from src.services.base_metadata_extractor import create_metadata_extractor

extractor = create_metadata_extractor("GEMINI")

# Test same query multiple times
query = "T-Fire - Say A Prayer"
results = []

for i in range(5):
    result = extractor.extract_metadata_from_filename(query)
    results.append(result)
    print(f"Run {i+1}: {result.get('artist')} - {result.get('title')}")

# Check if all results are identical
all_same = all(r == results[0] for r in results)
print(f"All results identical: {all_same}")
```

## Troubleshooting

### Still Getting Variations?

1. **Check seed is set**: Ensure `GEMINI_SEED` or `OPENAI_SEED` is a fixed integer
2. **Verify temperature**: Should be `0` or very close to `0`
3. **Check model version**: Model updates can cause variations
4. **URL context consistency**: If using URL context, ensure URLs return same content
5. **Filename cleaning**: The cleaning step should produce consistent outputs

### Performance vs Consistency Trade-off

- **Maximum consistency**: temperature=0, seed=fixed, top_k=1
- **Slight creativity**: temperature=0.1-0.2, seed=fixed
- **More variation**: temperature>0.2, no seed

Choose based on your needs: metadata extraction typically benefits from maximum consistency.
