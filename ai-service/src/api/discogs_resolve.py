"""
Discogs URL resolution API endpoint.

POST /api/v1/discogs/resolve-url - search Discogs for {artist, title} and
return the matched release URL, if any.
"""

from flask import request
from flask_restful import Resource
from loguru import logger

from src.scrappers.discogs_resolver import resolve_url


class DiscogsResolveResource(Resource):
    def post(self):
        """
        Request body:
            { "artist": str, "title": str }

        Returns:
            dict: { "discogsUrl": str | None }
        """
        data = request.get_json(silent=True) or {}
        artist = (data.get("artist") or "").strip()
        title = (data.get("title") or "").strip()

        if not artist and not title:
            return {"error": "artist or title is required"}, 400

        query = f"{artist} {title}".strip()
        try:
            discogs_url = resolve_url(query)
        except Exception as e:
            logger.error(f"discogs resolve-url failed for '{query}': {e}")
            return {"error": "Resolution failed", "message": str(e)}, 500

        return {"discogsUrl": discogs_url}, 200
