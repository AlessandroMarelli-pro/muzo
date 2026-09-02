"""
Shared filename cleanup helpers for the analysis pipeline.

These are the deterministic rules that run on every filename regardless of
whether the Gemini cleaner was available -- the LLM prompt asks for the same
normalisation, but it is best-effort (it frequently echoes its input back
unchanged), so the guarantees live here.

The ordering matters and is applied by ``split_artist_title``:

    normalise unicode -> strip vinyl side marker -> split on separator
    -> strip trailing junk from the title -> extract year

Every rule here is deliberately narrow. Filenames are the only artist/title
signal for a lot of the library, so a rule that strips too much silently
destroys real metadata -- the tests in
tests/services/test_filename_cleanup.py pin the cases that must NOT change.
"""

import re
from typing import Tuple

# yt-dlp rewrites characters that are illegal in filenames to lookalike
# codepoints. They come back to us in the filename verbatim, so map them home
# before any separator matching -- otherwise "A ⧸⧸ B" reads as plain title text.
_YTDLP_SUBSTITUTIONS = {
    "⧸": "/",  # BIG SOLIDUS
    "⧹": "\\",  # BIG REVERSE SOLIDUS
    "｜": "|",  # FULLWIDTH VERTICAL LINE
    "：": ":",  # FULLWIDTH COLON
    "？": "?",  # FULLWIDTH QUESTION MARK
    "＂": '"',  # FULLWIDTH QUOTATION MARK
    "＊": "*",  # FULLWIDTH ASTERISK
    "＜": "<",  # FULLWIDTH LESS-THAN
    "＞": ">",  # FULLWIDTH GREATER-THAN
}

# Zero-width and directional marks. These are invisible but break equality and
# regex anchors -- one of the real library files carries a U+200E between the
# label name and its catalog number.
_INVISIBLE_RE = re.compile(r"[​-‏﻿]")

# A vinyl side/position marker: side A, B1, A2 ... Deliberately exact.
# "A406", "AB", "404", "7FO" and "C.K" are real artist names and must not match.
_VINYL_SIDE_RE = re.compile(r"^[A-F][1-9]?$", re.IGNORECASE)

# Artist/title separators. Only *spaced* forms -- a bare hyphen must never
# split "Saiko-Pod - Wednesday".
#
# " / " is deliberately NOT here. Sweeping the library showed it almost always
# separates co-artists ("Habibi Funk / Ahmed Ben Ali"), an A/B-side pairing
# ("Skyline / I Dream Of Jeanie") or copyright years ("(P1986 / C1987)") --
# splitting on it moved the artist boundary to the wrong place far more often
# than it helped. " // " is handled as a special case in split_artist_title.
_SEPARATORS = (" - ", " – ", " — ", " ~ ", " _ ")

# Parenthetical/bracketed suffixes that are part of the title and must survive
# every stripping rule below: mix names, remix credits, edits, versions.
_MIX_KEYWORD_RE = re.compile(
    r"\b(mix|remix|rmx|dub|edit|version|instrumental|vocal|re-?work|bootleg|"
    r"vip|refix|extended|radio|club|original)\b",
    re.IGNORECASE,
)

# Bare genre tags that show up as a trailing "(House)" / "{Progressive House}".
# Conservative on purpose: only stripped when the run has no mix keyword.
_GENRE_WORDS = (
    "house", "deep house", "tech house", "progressive house", "acid house",
    "techno", "minimal", "trance", "psytrance", "electro", "electronic",
    "ambient", "downtempo", "trip hop", "hip hop", "breakbeat", "breaks",
    "drum and bass", "drum & bass", "dnb", "jungle", "garage", "ukg",
    "dubstep", "disco", "nu disco", "funk", "soul", "jazz", "reggae", "dub techno",
    "italo", "italo disco", "synth pop", "new wave", "idm", "experimental",
    "leftfield", "balearic", "afro", "afrobeat", "latin", "world",
)
_GENRE_RE = re.compile(
    r"\s*[\(\[\{](?:" + "|".join(re.escape(g) for g in _GENRE_WORDS) + r")[\)\]\}]",
    re.IGNORECASE,
)

# Trailing catalog tag: "[BV3013]", "(FLING007)", "[CAT 12]".
_CATALOG_RE = re.compile(r"\s*[\[\(\{][A-Z]{2,}[\s-]?\d{2,}[\]\)\}]\s*$", re.IGNORECASE)

# A "|Label|" run -- delimited on BOTH sides, which is what distinguishes it
# from "|" used as an artist/title separator.
_PIPE_LABEL_RE = re.compile(r"\s*\|[^|]+\|\s*")

# ", VC Recordings – VCRTDJ 11" : a label/catalog tail introduced by a comma.
# The dash here is NOT an artist/title separator, which is why title splitting
# has to happen before this runs.
_LABEL_TAIL_RE = re.compile(
    r"\s*,\s*[^,()\[\]]+?\s*[-–—]\s*[A-Z0-9][A-Z0-9\s\-]*\d\s*$", re.IGNORECASE
)

# A bare 4-digit year, bracketed or not, at the end of the string.
_YEAR_TRAILING_RE = re.compile(r"[\(\[\{]?((?:19|20)\d{2})[\)\]\}]?\s*$")

# A trailing bare number that is not a year: track/order suffixes like "- 0401".
_NUMERIC_TAIL_RE = re.compile(r"\s*-\s*\d{3,}\s*$")


def normalize_unicode(text: str) -> str:
    """Map yt-dlp filename substitutions back and drop invisible marks."""
    if not text:
        return ""
    for bad, good in _YTDLP_SUBSTITUTIONS.items():
        text = text.replace(bad, good)
    return _INVISIBLE_RE.sub("", text)


def strip_vinyl_side(text: str) -> str:
    """Drop a leading vinyl side marker ("A - ", "B1 - ") if present.

    Only ever removes a marker that is followed by a spaced hyphen, so a real
    artist called "A406" or "Sade" is untouched.
    """
    head, sep, rest = text.partition(" - ")
    if sep and _VINYL_SIDE_RE.match(head.strip()) and rest.strip():
        return rest.strip()
    return text


def _balanced(text: str) -> bool:
    """True when no bracket is left open -- used to refuse a strip that would
    cut into a parenthetical like "Love Song (US, 1974)"."""
    for open_c, close_c in (("(", ")"), ("[", "]"), ("{", "}")):
        if text.count(open_c) != text.count(close_c):
            return False
    return True


def _strip_year(title: str) -> Tuple[str, str]:
    """Pull a trailing year off the title. Returns (title, year).

    Refuses to cut into an unclosed bracket: "Love Song (US, 1974)" keeps its
    whole parenthetical rather than becoming "Love Song (US".
    """
    m = _YEAR_TRAILING_RE.search(title)
    if not m:
        return title.strip(), ""
    # Refuse to eat a title that is *only* a year ("1999" by Prince).
    remainder = title[: m.start()].strip().rstrip(",").strip()
    if not remainder or not _balanced(remainder):
        return title.strip(), ""
    return remainder, m.group(1)


def strip_title_junk(title: str) -> Tuple[str, str, str]:
    """Strip label/catalog/genre/numeric noise off a title.

    Returns (title, year, label). Mix and remix credits are always preserved.
    """
    label = ""

    # "|Fade Records|" -> label, not a separator.
    m = _PIPE_LABEL_RE.search(title)
    if m:
        label = m.group(0).strip().strip("|").strip()
        title = _PIPE_LABEL_RE.sub(" ", title).strip()

    # ", VC Recordings – VCRTDJ 11"
    m = _LABEL_TAIL_RE.search(title)
    if m:
        if not label:
            tail = m.group(0).strip().lstrip(",").strip()
            label = re.split(r"\s*[-–—]\s*", tail)[0].strip()
        title = title[: m.start()].strip()

    # Year can sit before or after the tags, so try once here and once at the end.
    title, year = _strip_year(title)

    # Bare genre tags -- never one carrying a mix keyword.
    def _drop_genre(match: re.Match) -> str:
        return "" if not _MIX_KEYWORD_RE.search(match.group(0)) else match.group(0)

    title = _GENRE_RE.sub(_drop_genre, title).strip()

    # Trailing catalog tag, but keep "[Walther Remix]".
    m = _CATALOG_RE.search(title)
    if m and not _MIX_KEYWORD_RE.search(m.group(0)):
        title = title[: m.start()].strip()

    # Trailing "- 0401" style ordering suffix.
    title = _NUMERIC_TAIL_RE.sub("", title).strip()

    if not year:
        title, year = _strip_year(title)

    return title.strip(" -–—,"), year, label


def split_artist_title(text: str) -> Tuple[str, str]:
    """Split a filename into (artist, title).

    Strips a vinyl side marker first, then splits on the first *spaced*
    separator. When nothing is left to split on, the artist is empty rather
    than invented -- "A4 - Hypnotised" is a title with no artist, not an
    artist called "a4".
    """
    text = normalize_unicode(text or "").strip()
    text = strip_vinyl_side(text)

    # " // " is a bandcamp/soundcloud artist-title convention and is
    # unambiguous, unlike a single " / " (see the _SEPARATORS note).
    left, sep, right = text.partition(" // ")
    if sep and left.strip() and right.strip():
        return left.strip(), right.strip()

    for sep in _SEPARATORS:
        if sep in text:
            left, _, right = text.partition(sep)
            if left.strip() and right.strip():
                return left.strip(), right.strip()

    return "", text.strip()
