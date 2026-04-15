# Copyright (c) 2025 Efstratios Goudelis
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

"""Horizons API client for celestial vectors."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import requests

HORIZONS_API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"


def _extract_ephemeris_line(result_text: str) -> Optional[str]:
    lines = result_text.splitlines()
    in_data = False
    for line in lines:
        if "$$SOE" in line:
            in_data = True
            continue
        if "$$EOE" in line:
            break
        if in_data and line.strip():
            return line.strip()
    return None


def _parse_vector_line(line: str) -> Optional[Dict[str, List[float]]]:
    parts = [part.strip() for part in line.split(",")]
    if len(parts) < 8:
        return None

    try:
        x_val = float(parts[2])
        y_val = float(parts[3])
        z_val = float(parts[4])
        vx_val = float(parts[5])
        vy_val = float(parts[6])
        vz_val = float(parts[7])
    except (ValueError, IndexError):
        return None

    return {
        "position_xyz_au": [x_val, y_val, z_val],
        "velocity_xyz_au_per_day": [vx_val, vy_val, vz_val],
    }


def fetch_celestial_vectors(
    command: str,
    epoch: datetime,
    timeout_seconds: float = 10.0,
) -> Dict[str, object]:
    """Fetch celestial state vectors from Horizons at a given epoch."""
    utc_epoch = epoch.astimezone(timezone.utc)
    start_time = (utc_epoch - timedelta(minutes=1)).strftime("%Y-%m-%d %H:%M")
    stop_time = (utc_epoch + timedelta(minutes=1)).strftime("%Y-%m-%d %H:%M")

    params = {
        "format": "json",
        "COMMAND": f"'{command}'",
        "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "VECTORS",
        "CENTER": "'500@10'",
        "REF_PLANE": "ECLIPTIC",
        "OUT_UNITS": "AU-D",
        "VEC_TABLE": "2",
        "CSV_FORMAT": "YES",
        "START_TIME": f"'{start_time}'",
        "STOP_TIME": f"'{stop_time}'",
        "STEP_SIZE": "'1 m'",
    }

    response = requests.get(HORIZONS_API_URL, params=params, timeout=timeout_seconds)
    response.raise_for_status()

    payload = response.json()
    result_text = payload.get("result", "")
    data_line = _extract_ephemeris_line(result_text)

    if not data_line:
        raise ValueError(f"No ephemeris data returned by Horizons for command '{command}'")

    parsed = _parse_vector_line(data_line)
    if not parsed:
        raise ValueError(f"Failed parsing Horizons vector line for command '{command}'")

    signature = payload.get("signature", {})

    return {
        "command": command,
        "position_xyz_au": parsed["position_xyz_au"],
        "velocity_xyz_au_per_day": parsed["velocity_xyz_au_per_day"],
        "source": "horizons",
        "horizons_signature": signature,
        "fetched_at_utc": datetime.now(timezone.utc).isoformat(),
    }
