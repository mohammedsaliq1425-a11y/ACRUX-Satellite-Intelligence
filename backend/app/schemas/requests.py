from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class LinkBudgetRequest(BaseModel):
    freq_ghz: float = Field(gt=0.1, le=300, description="Carrier frequency, GHz")
    tx_power_w: float = Field(gt=0, le=1e6, description="Transmit power, watts")
    tx_gain_dbi: float = Field(ge=-20, le=90)
    rx_gain_dbi: float = Field(ge=-20, le=90)
    system_noise_temp_k: float = Field(gt=0, le=10000)
    bandwidth_hz: float = Field(gt=0, le=1e11)
    distance_km: float | None = Field(default=None, ge=1, le=1_000_000)
    altitude_km: float | None = Field(default=None, gt=0, le=400_000)
    elevation_deg: float | None = Field(default=None, ge=0, le=90)
    other_losses_db: float = Field(default=0.0, ge=0, le=100)
    required_cn_db: float | None = Field(default=None, ge=-30, le=60)

    @model_validator(mode="after")
    def _need_geometry(self):
        if self.distance_km is None and (self.altitude_km is None or self.elevation_deg is None):
            raise ValueError("Provide distance_km, or both altitude_km and elevation_deg")
        return self


class OrbitComparisonRequest(BaseModel):
    freq_ghz: float = Field(gt=0.1, le=300)
    min_elevation_deg: float = Field(default=10.0, ge=0, lt=90)


class SimSatIn(BaseModel):
    prn: str = Field(min_length=1, max_length=8)
    az_deg: float = Field(ge=0, le=360)
    el_deg: float = Field(ge=-90, le=90)


class GnssRequest(BaseModel):
    lat_deg: float = Field(ge=-90, le=90)
    lon_deg: float = Field(ge=-180, le=180)
    height_m: float = Field(default=0.0, ge=-500, le=10000)
    satellites: list[SimSatIn] = Field(min_length=4, max_length=24)
    noise_sigma_m: float = Field(default=5.0, ge=0, le=100)
    clock_bias_m: float = Field(default=0.0, ge=-1e6, le=1e6)
    elevation_mask_deg: float = Field(default=5.0, ge=0, le=45)
    seed: int = Field(default=1, ge=0, le=2**31 - 1)


class FaultIn(BaseModel):
    kind: Literal["solar_degradation", "excess_load", "thermal_excursion",
                  "attitude_drift", "comm_dropout"]
    start_min: float = Field(ge=0, le=1440)
    duration_min: float = Field(gt=0, le=1440)
    magnitude: float = Field(default=1.0, ge=0, le=1000)


class TelemetryRequest(BaseModel):
    duration_min: float = Field(default=240, ge=5, le=1440)
    step_s: float = Field(default=30, ge=5, le=300)
    seed: int = Field(default=42, ge=0, le=2**31 - 1)
    faults: list[FaultIn] = Field(default_factory=list, max_length=10)
    include_ml: bool = False
    save_run: bool = False   # optional: store a summary in Supabase when configured


class ContextItemIn(BaseModel):
    label: str = Field(max_length=80)
    kind: Literal["observed", "forecast", "derived", "simulated", "catalogue"] = "derived"
    source: str = Field(max_length=120)
    timestamp: str | None = Field(default=None, max_length=40)
    content: str = Field(max_length=4000)


class ChatMessageIn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatMessageIn] = Field(default_factory=list, max_length=20)
    context: list[ContextItemIn] = Field(default_factory=list, max_length=12)


class LocationIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    notes: str | None = Field(default=None, max_length=500)


class ReportIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    report_type: Literal["earth_observation", "wildfire", "weather", "telemetry", "astronomy", "multimodal"]
    payload: dict
    contains_simulated: bool = False
