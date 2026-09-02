"""
Regression tests for filename cleaning.

Bug: a track uploaded as "A - Circulation - Purple (Mix 1).opus" came out as
artist="a", title="circulation - purple (mix 1)". The leading "A" is a vinyl
side marker, not an artist -- 94 files in the reference library use this
convention (A, B, A1, B2, ...).

Three stages independently hard-coded "the first ' - ' separates artist from
title": the Gemini prompt, extract_id3_tags's YouTube branch, and
_split_cleaned_filename. The deterministic helpers in
src/services/filename_cleanup.py are now the single source of truth, since the
LLM is best-effort and frequently echoes its input back unchanged.

The "must NOT change" cases below matter as much as the fixes: a length-based
"drop short leading token" rule would have destroyed the many real short artist
names in the library (Sade, Moby, Lone, Ghia, 404, 7FO, C.K, Nino).
"""

import pytest

from src.services.filename_cleanup import (
    normalize_unicode,
    split_artist_title,
    strip_title_junk,
    strip_vinyl_side,
)


def _clean(raw):
    """Full pipeline: (artist, title, year)."""
    artist, title = split_artist_title(raw)
    title, year, _label = strip_title_junk(title)
    return artist, title, year


class TestVinylSideMarkers:
    @pytest.mark.parametrize(
        "raw,artist,title",
        [
            # The reported bug.
            ("A - Circulation - Purple (Mix 1)", "Circulation", "Purple (Mix 1)"),
            (
                "B1 - Mental Generation - Cafe Del Mar (Original Mix)",
                "Mental Generation",
                "Cafe Del Mar (Original Mix)",
            ),
            (
                "A3 - Pavesi Sound - I'll Never Lose (Bonus Beat Mix 1)",
                "Pavesi Sound",
                "I'll Never Lose (Bonus Beat Mix 1)",
            ),
            (
                "A - Needle In The Groove - Full Moon Passion",
                "Needle In The Groove",
                "Full Moon Passion",
            ),
            # Side marker with no artist behind it: the artist must stay empty
            # rather than being invented from the marker.
            ("A4 - Hypnotised", "", "Hypnotised"),
            ("A2 - Diact", "", "Diact"),
            ("D - City Boy (Ambient Mix)", "", "City Boy (Ambient Mix)"),
            # Side marker uses a hyphen, the real split is an en dash.
            ("A2 - A  Burger – Device B", "A  Burger", "Device B"),
        ],
    )
    def test_side_marker_is_stripped(self, raw, artist, title):
        got_artist, got_title, _ = _clean(raw)
        assert (got_artist, got_title) == (artist, title)

    @pytest.mark.parametrize(
        "raw,artist",
        [
            # Real short artist names -- a length heuristic would eat all of these.
            ("Sade - Smooth Operator", "Sade"),
            ("Moby - Go", "Moby"),
            ("Lone - Pineapple Crush", "Lone"),
            ("Ghia - Believer", "Ghia"),
            ("404 - Der", "404"),
            ("7FO - Healing Sword", "7FO"),
            ("C.K - Some Track", "C.K"),
            ("Nino - El Ritmo Del Tambor", "Nino"),
            # Letter-and-digits, but not the side-marker shape.
            ("A406 - Some Track", "A406"),
            ("AB - Some Track", "AB"),
        ],
    )
    def test_real_short_artists_are_preserved(self, raw, artist):
        assert _clean(raw)[0] == artist

    def test_strip_vinyl_side_is_a_noop_without_a_marker(self):
        assert strip_vinyl_side("Sade - Smooth Operator") == "Sade - Smooth Operator"
        assert strip_vinyl_side("Just A Title") == "Just A Title"


class TestSeparators:
    def test_bare_hyphen_never_splits(self):
        # The reason _split_cleaned_filename avoids HybridFilenameParser.
        assert _clean("Saiko-Pod - Wednesday")[:2] == ("Saiko-Pod", "Wednesday")
        assert _clean("T-Fire - Say A Prayer")[:2] == ("T-Fire", "Say A Prayer")

    def test_first_separator_wins_for_genuine_multi_segment_artists(self):
        artist, title, _ = _clean("Low Flung, DJ Mind Leaf, The Herbalist - Take Out")
        assert artist == "Low Flung, DJ Mind Leaf, The Herbalist"
        assert title == "Take Out"

    def test_en_dash_splits(self):
        assert _clean("Luminary – My World (Original Mix)")[:2] == (
            "Luminary",
            "My World (Original Mix)",
        )

    def test_double_slash_splits(self):
        # yt-dlp writes "/" as U+29F8 BIG SOLIDUS.
        assert _clean("Full Proof ⧸⧸ Nasty Habit (Enrico & Ton TB Remix)")[:2] == (
            "Full Proof",
            "Nasty Habit (Enrico & Ton TB Remix)",
        )

    def test_single_slash_does_not_split(self):
        # A single "/" separates co-artists or A/B sides far more often than it
        # separates artist from title, so it must not move the boundary.
        artist, title, _ = _clean("Salt Tank ‎– Skyline ⧸ I Dream Of Jeanie (A Side)")
        assert artist == "Salt Tank"
        assert title == "Skyline / I Dream Of Jeanie (A Side)"

    def test_no_separator_yields_no_artist(self):
        assert _clean("Just A Title")[:2] == ("", "Just A Title")


class TestUnicodeNormalization:
    def test_ytdlp_substitutions_are_mapped_back(self):
        assert normalize_unicode("a⧸b") == "a/b"
        assert normalize_unicode("a｜b") == "a|b"
        assert normalize_unicode('12＂ Version') == '12" Version'

    def test_invisible_marks_are_stripped(self):
        # U+200E LEFT-TO-RIGHT MARK, present in real library filenames.
        assert normalize_unicode("Carol‎ – Do You") == "Carol – Do You"


class TestTrailingJunk:
    @pytest.mark.parametrize(
        "raw,artist,title,year",
        [
            # Catalog tag + bare genre tag. Ground truth confirmed on disk:
            # the library holds the cleaned "Up To Date - Shadows.opus".
            ("Up To Date - Shadows (House) [BV3013]", "Up To Date", "Shadows", ""),
            # {genre} after a non-trailing year.
            (
                "ABA Structure - Over Unity [2002] {Progressive House}",
                "ABA Structure",
                "Over Unity",
                "2002",
            ),
            # |Label| delimited on both sides -- a label, not a separator.
            (
                "Kolo - Track One (Steve Porter Remix)  ｜Fade Records｜ 2000",
                "Kolo",
                "Track One (Steve Porter Remix)",
                "2000",
            ),
            # Bare year, then ", label – catalog". The en dash here is NOT an
            # artist/title separator.
            (
                "Bullitt - Cried To Dream (Amazonian Vocal) 1996, "
                "VC Recordings ‎– VCRTDJ 11",
                "Bullitt",
                "Cried To Dream (Amazonian Vocal)",
                "1996",
            ),
            # Trailing numeric ordering suffix, remix credit preserved.
            (
                "Betina Bager & Brian O - Singing In The Rain (Love Baby) "
                "[Walther Remix] - 0401",
                "Betina Bager & Brian O",
                "Singing In The Rain (Love Baby) [Walther Remix]",
                "",
            ),
            # Year abutting a mix name with no space.
            (
                "Nino - El Ritmo Del Tambor (Vocal Mix)(2002)",
                "Nino",
                "El Ritmo Del Tambor (Vocal Mix)",
                "2002",
            ),
            ("Artist - Title (1979)", "Artist", "Title", "1979"),
            ("Finis Africae - Armadilha (1986)", "Finis Africae", "Armadilha", "1986"),
        ],
    )
    def test_junk_is_stripped(self, raw, artist, title, year):
        assert _clean(raw) == (artist, title, year)

    @pytest.mark.parametrize(
        "title_fragment",
        [
            "(Original Mix)",
            "(Vocal Mix)",
            "[Walther Remix]",
            "(Steve Porter Remix)",
            "(Extended Mix)",
            "(Ambient Mix)",
            "(Instrumental Version)",
        ],
    )
    def test_mix_and_remix_credits_are_never_stripped(self, title_fragment):
        _, title, _ = _clean(f"Some Artist - Some Track {title_fragment}")
        assert title == f"Some Track {title_fragment}"

    def test_year_inside_a_parenthetical_is_not_torn_out(self):
        # "Love Song (US, 1974)" must not become "Love Song (US".
        _, title, year = _clean("Soulpeace - Love Song (US, 1974)")
        assert title == "Love Song (US, 1974)"
        assert year == ""

    def test_label_is_reported_when_found(self):
        _, _, label = strip_title_junk("Track One (Steve Porter Remix) |Fade Records| 2000")
        assert label == "Fade Records"
