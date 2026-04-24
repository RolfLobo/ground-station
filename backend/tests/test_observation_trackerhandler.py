# Copyright (c) 2026 Efstratios Goudelis

import pytest

from observations.tasks.trackerhandler import TrackerHandler


class _DummyTrackerManager:
    def __init__(self, tracking_state=None):
        self.tracking_state = tracking_state or {}

    async def get_tracking_state(self):
        return dict(self.tracking_state)


@pytest.mark.asyncio
async def test_start_tracker_unparks_before_tracking_when_requested(monkeypatch):
    manager = _DummyTrackerManager({"rotator_state": "parked"})
    update_calls = []

    monkeypatch.setattr(
        "observations.tasks.trackerhandler.get_tracker_manager",
        lambda _tracker_id: manager,
    )

    async def _mock_update(tracker_id, value, requester_sid=None):
        update_calls.append(
            {"tracker_id": tracker_id, "value": value, "requester_sid": requester_sid}
        )
        return {"success": True}

    monkeypatch.setattr(
        "observations.tasks.trackerhandler.update_tracking_state_with_ownership",
        _mock_update,
    )

    handler = TrackerHandler()
    result = await handler.start_tracker_task(
        observation_id="obs-1",
        satellite={"norad_id": 25544, "group_id": "grp-1", "name": "ISS"},
        rotator_config={
            "id": "rot-1",
            "tracker_id": "target-1",
            "tracking_enabled": True,
            "unpark_before_tracking": True,
        },
        tasks=[],
    )

    assert result["success"] is True
    assert len(update_calls) == 2
    assert update_calls[0]["value"]["rotator_state"] == "connected"
    assert update_calls[0]["value"]["rotator_id"] == "rot-1"
    assert update_calls[1]["value"]["rotator_state"] == "tracking"
    assert update_calls[1]["value"]["rotator_id"] == "rot-1"


@pytest.mark.asyncio
async def test_stop_tracker_parks_when_requested(monkeypatch):
    calls = []

    async def _mock_update(tracker_id, value, requester_sid=None):
        calls.append(value)
        return {"success": True}

    monkeypatch.setattr(
        "observations.tasks.trackerhandler.update_tracking_state_with_ownership",
        _mock_update,
    )

    handler = TrackerHandler()
    ok = await handler.stop_tracker_task(
        observation_id="obs-2",
        rotator_config={
            "id": "rot-1",
            "tracker_id": "target-1",
            "tracking_enabled": True,
            "park_after_observation": True,
        },
    )

    assert ok is True
    assert calls == [{"rotator_state": "parked", "rotator_id": "rot-1"}]


@pytest.mark.asyncio
async def test_stop_tracker_leaves_rotator_connected_by_default(monkeypatch):
    calls = []

    async def _mock_update(tracker_id, value, requester_sid=None):
        calls.append(value)
        return {"success": True}

    monkeypatch.setattr(
        "observations.tasks.trackerhandler.update_tracking_state_with_ownership",
        _mock_update,
    )

    handler = TrackerHandler()
    ok = await handler.stop_tracker_task(
        observation_id="obs-3",
        rotator_config={
            "id": "rot-1",
            "tracker_id": "target-1",
            "tracking_enabled": True,
            "park_after_observation": False,
        },
    )

    assert ok is True
    assert calls == []


@pytest.mark.asyncio
async def test_start_tracker_returns_rotator_in_use_error(monkeypatch):
    manager = _DummyTrackerManager({"rotator_state": "connected"})
    monkeypatch.setattr(
        "observations.tasks.trackerhandler.get_tracker_manager",
        lambda _tracker_id: manager,
    )

    async def _mock_update(tracker_id, value, requester_sid=None):
        return {
            "success": False,
            "error": "rotator_in_use",
            "message": "Rotator 'rot-1' is already assigned to tracker 'target-2'.",
            "data": {"owner_tracker_id": "target-2"},
        }

    monkeypatch.setattr(
        "observations.tasks.trackerhandler.update_tracking_state_with_ownership",
        _mock_update,
    )

    handler = TrackerHandler()
    result = await handler.start_tracker_task(
        observation_id="obs-4",
        satellite={"norad_id": 25544, "group_id": "grp-1", "name": "ISS"},
        rotator_config={
            "id": "rot-1",
            "tracker_id": "target-1",
            "tracking_enabled": True,
        },
        tasks=[],
    )

    assert result["success"] is False
    assert result["error"] == "rotator_in_use"
