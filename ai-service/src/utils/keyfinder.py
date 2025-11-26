"""
original code from 'https://github.com/jackmcarthur/musical-key-finder'
modified by: 'bin2ai' to be used as an installable package with pip
"""

import audioflux as af
import numpy as np
from loguru import logger

# class that uses the librosa library to analyze the key that an mp3 is in
# arguments:
#     waveform: an mp3 file loaded by librosa, ideally separated out from any percussive sources
#     sr: sampling rate of the mp3, which can be obtained when the file is read with librosa
#     tstart and tend: the range in seconds of the file to be analyzed; default to the beginning and end of file if not specified


class KeyFinder(object):
    waveform: np.ndarray = None  # waveform of song

    sr: int = None  # sampling rate

    chromograph: np.ndarray = None  # chroma graph of song segment
    chroma_vals: list = None  # amount of each pitch class present in this time interval
    keyfreqs: dict = None  # pitch names to the associated intensity in the song
    min_key_corrs: list = None  # correlations between pitch class vs minor keys
    maj_key_corrs: list = None  # correlations between pitch class vs major keys
    key_dict: dict = None  # dictionary of the musical keys (major/minor)
    key_primary: str = None  # key determined by the algorithm
    # strength of correlation for the key determined by the algorithm
    best_corr_primary: float = None
    key_alt: str = None  # alternative key determined by the algorithm
    best_corr_alt: float = None  # strength of correlation for the alternative key
    chroma_max: float = None  # maximum value of the chroma graph
    pitch_max: str = None  # pitch class with the highest intensity in the song segment
    pitch_max_corr: float = None  # strength of pitch class with the highest intensity
    pitches: list = None  # list of pitch classes
    # major key profile from Krumhansl-Schmuckler algorithm
    major_profile_ks: list = None
    # minor key profile from Krumhansl-Schmuckler algorithm
    minor_profile_ks: list = None
    confidence: float = None  # confidence in the key detection (0-1)

    def __init__(
        self,
        y: np.ndarray,
        sr: int,
        title: str = None,  # title of song, if None, defaults to filename from path
    ) -> None:
        self.waveform = y
        self.sr = sr

        self.chromograph = af.chroma_cqt(y, samplate=self.sr)
        # self.chromograph = af.chroma_cqt(
        #    y, samplate=self.sr, num=7 * 24, bin_per_octave=24
        # )

        # chroma_vals is the amount of each pitch class present in this time interval
        self.chroma_vals = []
        for i in range(12):
            self.chroma_vals.append(np.sum(self.chromograph[i]))
        pitches = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        # dictionary relating pitch names to the associated intensity in the song
        self.keyfreqs = {pitches[i]: self.chroma_vals[i] for i in range(12)}

        keys = [pitches[i] + " major" for i in range(12)] + [
            pitches[i] + " minor" for i in range(12)
        ]

        # use of the Krumhansl-Schmuckler key-finding algorithm, which compares the chroma
        # data above to typical profiles of major and minor keys:
        maj_profile = [
            6.35,
            2.23,
            3.48,
            2.33,
            4.38,
            4.09,
            2.52,
            5.19,
            2.39,
            3.66,
            2.29,
            2.88,
        ]
        min_profile = [
            6.33,
            2.68,
            3.52,
            5.38,
            2.60,
            3.53,
            2.54,
            4.75,
            3.98,
            2.69,
            3.34,
            3.17,
        ]

        # finds correlations between the amount of each pitch class in the time interval and the above profiles,
        # starting on each of the 12 pitches. then creates dict of the musical keys (major/minor) to the correlation
        self.min_key_corrs = []
        self.maj_key_corrs = []
        for i in range(12):
            key_test = [self.keyfreqs.get(pitches[(i + m) % 12]) for m in range(12)]
            # correlation coefficients (strengths of correlation for each key)
            # Handle zero-variance arrays to avoid NaN from corrcoef
            if np.std(key_test) == 0 or np.std(maj_profile) == 0:
                maj_corr = 0.0
            else:
                maj_corr_matrix = np.corrcoef(maj_profile, key_test)
                maj_corr = maj_corr_matrix[1, 0] if not np.isnan(maj_corr_matrix[1, 0]) else 0.0

            if np.std(key_test) == 0 or np.std(min_profile) == 0:
                min_corr = 0.0
            else:
                min_corr_matrix = np.corrcoef(min_profile, key_test)
                min_corr = min_corr_matrix[1, 0] if not np.isnan(min_corr_matrix[1, 0]) else 0.0

            self.maj_key_corrs.append(round(maj_corr, 3))
            self.min_key_corrs.append(round(min_corr, 3))

        # names of all major and minor keys
        self.key_dict = {
            **{keys[i]: self.maj_key_corrs[i] for i in range(12)},
            **{keys[i + 12]: self.min_key_corrs[i] for i in range(12)},
        }

        # this attribute represents the key determined by the algorithm
        self.key = max(self.key_dict, key=self.key_dict.get)
        self.bestcorr = max(self.key_dict.values())

        # this attribute represents the second-best key determined by the algorithm,
        # if the correlation is close to that of the actual key determined
        self.altkey = None
        self.altbestcorr = None

        for key, corr in self.key_dict.items():
            if corr > self.bestcorr * 0.9 and corr != self.bestcorr:
                self.altkey = key
                self.altbestcorr = corr
