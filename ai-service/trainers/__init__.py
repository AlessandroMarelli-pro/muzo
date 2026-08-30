"""Training-time packages.

Only ``trainers.filename_parser`` is shipped in the deployed image (see
``.dockerignore``); it is imported at runtime by
``src.services.simple_filename_parser`` to load the hybrid filename parser and
its sklearn models under ``filename_models/``. The pickled feature extractor
references the fully-qualified module path
``trainers.filename_parser.model_training``, so this package must be importable
as ``trainers`` (not just a namespace-package fallback).
"""
