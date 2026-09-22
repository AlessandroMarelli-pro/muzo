"""
Bandcamp URL resolution API endpoint.

POST /api/v1/bandcamp/resolve-url - search Bandcamp for {artist, title} and
return the matched release URL, if any.
"""

from flask import request
from flask_restful import Resource
from loguru import logger

from src.scrappers.bancamp_scrapper import resolve_url


class BandcampResolveResource(Resource):
    def post(self):
        """
        Request body:
            { "artist": str, "title": str }

        Returns:
            dict: { "bandcampUrl": str | None }
        """
        data = request.get_json(silent=True) or {}
        artist = (data.get("artist") or "").strip()
        title = (data.get("title") or "").strip()

        if not artist and not title:
            return {"error": "artist or title is required"}, 400

        query = f"{artist} {title}".strip()
        try:
            bandcamp_url = resolve_url(query)
        except Exception as e:
            logger.error(f"bandcamp resolve-url failed for '{query}': {e}")
            return {"error": "Resolution failed", "message": str(e)}, 500

        return {"bandcampUrl": bandcamp_url}, 200
