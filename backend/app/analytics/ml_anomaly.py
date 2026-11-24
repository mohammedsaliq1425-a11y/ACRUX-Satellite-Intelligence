"""Optional unsupervised detector (scikit-learn IsolationForest).

Fitted ONLY on nominal SIMULATED telemetry generated locally. It flags samples
that look statistically unusual compared with that simulated baseline. It has
not been validated on real spacecraft data and gives no root cause; use it as a
secondary signal next to the rule-based detector.
"""
from __future__ import annotations

import numpy as np
from sklearn.ensemble import IsolationForest

from ..simulations.telemetry import SimConfig, generate

FEATURES = ["battery_soc_pct", "solar_power_w", "bus_load_w", "bus_temp_c",
            "attitude_error_deg", "comm_link_up", "sunlit"]


def _matrix(samples: list[dict]) -> np.ndarray:
    return np.array([[float(s[f]) for f in FEATURES] for s in samples])


class MLDetector:
    def __init__(self, seed: int = 7, train_duration_min: float = 480.0,
                 score_quantile: float = 0.005):
        base = generate(SimConfig(duration_min=train_duration_min, seed=seed + 1000))
        x = _matrix(base["samples"])
        self.mean, self.std = x.mean(axis=0), x.std(axis=0) + 1e-9
        self.model = IsolationForest(n_estimators=200, random_state=seed)
        self.model.fit((x - self.mean) / self.std)
        train_scores = self.model.score_samples((x - self.mean) / self.std)
        self.threshold = float(np.quantile(train_scores, score_quantile))
        self.n_train = len(x)

    def score(self, samples: list[dict]) -> list[dict]:
        x = (_matrix(samples) - self.mean) / self.std
        scores = self.model.score_samples(x)
        out = []
        for s, row, sc in zip(samples, x, scores):
            if sc < self.threshold:
                j = int(np.argmax(np.abs(row)))
                out.append({"t_s": s["t_s"], "timestamp": s["timestamp"],
                            "score": float(sc), "threshold": self.threshold,
                            "most_deviant_feature": FEATURES[j],
                            "z_of_feature": float(row[j])})
        return out

    def describe(self) -> dict:
        return {"method": "IsolationForest (unsupervised)", "n_train_samples": self.n_train,
                "trained_on": "locally generated nominal SIMULATED telemetry",
                "validated_on_real_data": False,
                "threshold_score": self.threshold}
