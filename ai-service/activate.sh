#!/bin/bash
echo "Activating Muzo AI Service environment..."
source "/Users/alessandro/dev/cursor-dev/muzo/ai-service/venv/bin/activate"
echo "Environment activated! You can now run the AI service."
echo ""
echo "To start the service:"
echo "  python app.py"
echo ""
echo "To run tests:"
echo "  python -m pytest"
echo ""
exec bash
