/** Shapes returned by the Project Acrux backend. Mirrors backend/app/integrations/common.py. */

export type DataKind =
  | "observation" | "forecast" | "reanalysis" | "catalogue" | "derived" | "simulation" | "calculation";

export interface Envelope<T> {
  data: T;
  meta: {
    source: string;
    source_url: string;
    kind: DataKind;
    retrieved_at: string;
    cached: boolean;
    notes: string[];
  };
}

export type SourceStatusValue =
  | "not_configured" | "configured_untested" | "reachable" | "returning_data"
  | "rate_limited" | "unavailable" | "auth_failed";

export interface SourceInfo {
  id: string;
  name: string;
  purpose: string;
  auth_requirement: "required" | "optional" | "none";
  key_env_var: string | null;
  key_configured: boolean | null;
  status: SourceStatusValue;
  note: string | null;
  last_success_at: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  docs_url: string;
  test_available: boolean;
}

export interface SourcesResponse { sources: SourceInfo[] }
export interface SourceTestResponse { ok: boolean; source: SourceInfo }
export interface HealthResponse { status: string; service: string; time_utc: string }

export interface NasaImage {
  nasa_id: string | null;
  title: string | null;
  description: string | null;
  date_created: string | null;
  center: string | null;
  photographer: string | null;
  secondary_creator: string | null;
  keywords: string[] | null;
  preview_url: string | null;
  media_type: string | null;
}

/* ---------------------------------------------------------------- Phase 3-5 shapes */
export interface Place { name: string; latitude: number; longitude: number; elevation_m: number | null; country: string | null; admin1: string | null; timezone: string | null; population: number | null }

export interface Forecast {
  latitude: number; longitude: number; elevation: number | null; timezone: string; timezone_abbreviation: string; utc_offset_seconds: number;
  current_units: Record<string, string>; current: Record<string, number | string | null>;
  hourly_units: Record<string, string>; hourly: Record<string, (number | string | null)[]>;
  daily_units: Record<string, string>; daily: Record<string, (number | string | null)[]>;
}
export interface History { latitude: number; longitude: number; timezone: string; daily_units: Record<string, string>; daily: Record<string, (number | string | null)[]> }

export interface FireRecord {
  latitude: number; longitude: number; acq_date: string | null; acq_time: string | null; acq_datetime_utc: string | null;
  satellite: string | null; instrument: string | null; confidence: string | null; frp: number | null; daynight: string | null;
  brightness: number | null; bright_ti4: number | null; bright_ti5: number | null; bright_t31: number | null; scan: number | null; track: number | null; version: string | null;
}
export interface FireSummary { count: number; frp_mw_total: number | null; frp_mw_max: number | null; frp_mw_mean: number | null; frp_records_with_value: number; by_date: Record<string, number>; by_confidence: Record<string, number>; by_daynight: Record<string, number> }
export interface FiresData { records: FireRecord[]; summary: FireSummary; truncated: boolean; query: { bbox: number[]; source: string; day_range: number; start_date: string | null } }

export interface Earthquake { id: string | null; magnitude: number | null; magnitude_type: string | null; place: string | null; time_utc: string | null; longitude: number; latitude: number; depth_km: number | null; url: string | null; tsunami_flag: number | null; significance: number | null; status: string | null }

export interface Apod { title: string; date: string; explanation: string; media_type: string; url: string; hdurl: string | null; copyright: string | null; thumbnail_url: string | null }
export interface NeoRow { id: string | null; name: string | null; jpl_url: string | null; absolute_magnitude_h: number | null; diameter_m_min: number | null; diameter_m_max: number | null; potentially_hazardous: boolean | null; sentry_object: boolean | null; approach_date: string | null; approach_datetime: string | null; velocity_km_s: number | null; miss_distance_km: number | null; miss_distance_lunar: number | null; miss_distance_au: number | null; orbiting_body: string | null }
export interface CadRow { designation: string | null; des: string | null; approach_time_tdb: string | null; distance_au: number | null; distance_km: number | null; distance_lunar: number | null; distance_min_au: number | null; distance_max_au: number | null; v_rel_km_s: number | null; absolute_magnitude_h: number | null; diameter_km: number | null; time_uncertainty: string | null }
export interface SmallBody { full_name: string | null; designation: string | null; kind: string | null; neo: boolean | null; pha: boolean | null; orbit_class: string | null;
  orbit: { epoch_jd: number | null; moid_au: number | null; first_obs: string | null; last_obs: string | null; n_obs_used: number | null; frame: string; elements: Record<string, { value: number | null; sigma: number | null; units: string | null; title: string | null }> };
  physical: Record<string, { value: string | null; units: string | null; title: string | null }> }
export interface Exoplanet { pl_name: string; hostname: string | null; discoverymethod: string | null; disc_year: number | null; pl_rade: number | null; pl_bmasse: number | null; pl_orbper: number | null; pl_eqt: number | null; sy_dist: number | null; sy_snum: number | null; sy_pnum: number | null }
export interface ExoplanetData { planets: Exoplanet[]; units: Record<string, string>; adql: string }
export interface DebrisObject { name: string | null; norad_id: number | string | null; intl_designator: string | null; epoch: string | null; inclination_deg: number | null; eccentricity: number | null; mean_motion_rev_per_day: number | null; raan_deg: number | null; arg_perigee_deg: number | null; mean_anomaly_deg: number | null; semi_major_axis_km: number | null; perigee_alt_km: number | null; apogee_alt_km: number | null; period_min: number | null }
export interface DebrisData { group: string; group_label: string; objects: DebrisObject[] }

export interface LinkBudgetResult { distance_km: number; distance_source: string; eirp_dbw: number; fspl_db: number; rx_power_dbw: number; rx_power_dbm: number; noise_power_dbw: number; cn_db: number; cn0_dbhz: number; required_cn_db: number | null; link_margin_db: number | null; link_closes: boolean | null; one_way_delay_ms: number; round_trip_delay_ms: number; formulas: string[]; assumptions: string[] }
export interface OrbitRow { orbit: string; altitude_km: number; period_min: number; zenith_range_km: number; range_at_min_elevation_km: number; min_elevation_deg: number; fspl_zenith_db: number; fspl_min_elevation_db: number; one_way_delay_zenith_ms: number; round_trip_delay_zenith_ms: number; coverage_radius_km: number }
export interface GnssResult { simulated: boolean; satellites_used: string[]; satellites_excluded_below_mask: string[]; dop: { gdop: number; pdop: number; hdop: number; vdop: number; tdop: number }; error_enu_m: { east: number; north: number; up: number }; horizontal_error_m: number; vertical_error_m: number; expected_1sigma_horizontal_m: number; expected_1sigma_vertical_m: number; estimated_clock_bias_m: number; true_clock_bias_m: number; iterations: number; converged: boolean; residual_rms_m: number; noise_sigma_m: number; notes: string[] }

export interface TelemetrySample { t_s: number; timestamp: string; sunlit: boolean; in_ground_pass_window: boolean; battery_soc_pct: number; solar_power_w: number; bus_load_w: number; bus_temp_c: number; roll_deg: number; pitch_deg: number; yaw_deg: number; attitude_error_deg: number; comm_link_up: boolean; comm_snr_db: number | null; payload_state: string }
export interface Alert { id: string; rule_id: string; title: string; component: string; channel: string; severity: "warning" | "critical" | "info"; detected_t_s: number; detected_timestamp: string; end_t_s: number; end_timestamp: string; measured_value: number | string | boolean; peak_measured_value: number | string | boolean; expected_range: string; reason: string; suggested_action: string; sample_count: number; method: string }
export interface TelemetryResult { simulated: boolean; disclaimer: string; config: Record<string, unknown>; units: Record<string, string>; assumptions: string[]; samples: TelemetrySample[]; alerts: Alert[]; component_status: Record<string, "ok" | "warning" | "critical">; detector: { method: string; machine_learning: boolean }; ml_outliers?: { t_s: number; timestamp: string; score: number; most_deviant_feature: string }[]; ml_detector?: { method: string; trained_on: string; validated_on_real_data: boolean }; storage?: { saved: boolean; id?: string; reason?: string } }

export interface ChatReply { reply: string; model: string }
export interface StorageRow { id: string; created_at: string; [k: string]: unknown }
export interface StatusFlag { configured: boolean }
