from __future__ import annotations

import pytest

from handlers.entities import celestial


class _DummyLogger:
    def debug(self, *_args, **_kwargs):
        return None

    def info(self, *_args, **_kwargs):
        return None

    def warning(self, *_args, **_kwargs):
        return None


class _DummySio:
    def __init__(self):
        self.events = []

    async def emit(self, event, data):
        self.events.append((event, data))


class _DummySessionManager:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.asyncio
async def test_refresh_celestial_now_uses_network_fetch(monkeypatch):
    captured = {}
    sio = _DummySio()
    scene_data = {"celestial": [{"target_key": "mission:Voyager 1"}]}

    async def _stub_build_scene_payload(_data, _logger):
        return {"future_hours": 8760, "celestial": [{"command": "Voyager 1"}]}

    async def _stub_build_celestial_scene(**kwargs):
        captured.update(kwargs)
        return {"success": True, "data": scene_data}

    monkeypatch.setattr(celestial, "_build_scene_payload", _stub_build_scene_payload)
    monkeypatch.setattr(celestial, "build_celestial_scene", _stub_build_celestial_scene)

    result = await celestial.refresh_celestial_now(
        sio=sio,
        data={"future_hours": 8760},
        logger=_DummyLogger(),
        sid="sid-1",
    )

    assert result["success"] is True
    assert captured["force_refresh"] is True
    assert captured["allow_network_fetch"] is True
    assert sio.events == [
        ("solar-system-scene-update", scene_data),
        ("celestial-tracks-update", scene_data),
        ("celestial-scene-update", scene_data),
    ]


@pytest.mark.asyncio
async def test_refresh_monitored_celestial_now_uses_network_fetch(monkeypatch):
    captured = {}
    persisted_updates = []
    sio = _DummySio()

    async def _stub_fetch_monitored_celestial(_dbsession):
        return {
            "success": True,
            "data": [
                {
                    "id": "row-1",
                    "target_type": "mission",
                    "command": "Voyager 1",
                    "display_name": "Voyager 1",
                    "enabled": True,
                }
            ],
        }

    async def _stub_build_celestial_tracks(**kwargs):
        captured.update(kwargs)
        return {
            "success": True,
            "data": {
                "celestial": [{"target_key": "mission:Voyager 1"}],
                "meta": {"projection": {"future_hours": 8760}},
            },
        }

    async def _stub_update_refresh_state(_dbsession, updates):
        persisted_updates.extend(updates)
        return {"success": True}

    async def _stub_load_stream_observer_location():
        return None

    async def _stub_per_row_callback(_row, _index, _total):
        return None

    monkeypatch.setattr(celestial, "AsyncSessionLocal", lambda: _DummySessionManager())
    monkeypatch.setattr(
        celestial.crud_monitored,
        "fetch_monitored_celestial",
        _stub_fetch_monitored_celestial,
    )
    monkeypatch.setattr(
        celestial.crud_monitored,
        "update_monitored_celestial_refresh_state",
        _stub_update_refresh_state,
    )
    monkeypatch.setattr(
        celestial, "_load_stream_observer_location", _stub_load_stream_observer_location
    )
    monkeypatch.setattr(
        celestial, "_build_partial_row_emitter", lambda **_kwargs: _stub_per_row_callback
    )
    monkeypatch.setattr(celestial, "build_celestial_tracks", _stub_build_celestial_tracks)

    result = await celestial.refresh_monitored_celestial_now(
        sio=sio,
        data={"future_hours": 8760},
        logger=_DummyLogger(),
        sid="sid-1",
    )

    assert result["success"] is True
    assert captured["force_refresh"] is True
    assert captured["allow_network_fetch"] is True
    assert persisted_updates and persisted_updates[0]["id"] == "row-1"
    assert sio.events == [("celestial-tracks-update", result["data"])]
