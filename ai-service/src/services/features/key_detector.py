class KeyDetector:
    """
    Camelot wheel lookup for musical keys, used to derive `camelot_key` from
    the key string produced by SkeyExtractor (or an LLM-provided override).

    The actual key detection (formerly KeyFinder's chroma-correlation heuristic
    plus a tonnetz-based major/minor classifier) has been replaced by Deezer's
    S-KEY model -- see skey_extractor.py. This class now only holds the
    Camelot mapping table.
    """

    camelot_wheel = {
        # Major keys (inner circle)
        "C MAJOR": "8B",
        "G MAJOR": "9B",
        "D MAJOR": "10B",
        "A MAJOR": "11B",
        "E MAJOR": "12B",
        "B MAJOR": "1B",
        "F# MAJOR": "2B",
        "C# MAJOR": "3B",
        "G# MAJOR": "4B",
        "D# MAJOR": "5B",
        "A# MAJOR": "6B",
        "F MAJOR": "7B",
        # Minor keys (outer circle)
        "A MINOR": "8A",
        "E MINOR": "9A",
        "B MINOR": "10A",
        "F# MINOR": "11A",
        "C# MINOR": "12A",
        "G# MINOR": "1A",
        "D# MINOR": "2A",
        "A# MINOR": "3A",
        "F MINOR": "4A",
        "C MINOR": "5A",
        "G MINOR": "6A",
        "D MINOR": "7A",
    }
