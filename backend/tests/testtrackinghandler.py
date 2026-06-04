# Copyright (c) 2026 Efstratios Goudelis

from common.constants import RigStates
from handlers.entities.tracking import _normalize_target_update_payload


def test_mission_target_normalization_disables_rig_control():
    result = _normalize_target_update_payload(
        {
            "target_type": "mission",
            "command": "Juno",
            "target_name": "Juno",
            "rig_id": "rig-123",
            "rig_state": RigStates.CONNECTED,
            "transmitter_id": "tx-123",
            "rig_vfo": "1",
        }
    )

    assert result["success"] is True
    payload = result["value"]
    assert payload["target_type"] == "mission"
    assert payload["rig_id"] == "none"
    assert payload["rig_state"] == RigStates.DISCONNECTED
    assert payload["transmitter_id"] == "none"
    assert payload["rig_vfo"] == "none"


def test_body_target_normalization_disables_rig_control():
    result = _normalize_target_update_payload(
        {
            "target_type": "body",
            "body_id": "JUPITER",
            "target_name": "JUPITER",
            "rig_id": "rig-abc",
            "rig_state": RigStates.TRACKING,
            "transmitter_id": "tx-abc",
            "rig_vfo": "2",
        }
    )

    assert result["success"] is True
    payload = result["value"]
    assert payload["target_type"] == "body"
    assert payload["body_id"] == "jupiter"
    assert payload["rig_id"] == "none"
    assert payload["rig_state"] == RigStates.DISCONNECTED
    assert payload["transmitter_id"] == "none"
    assert payload["rig_vfo"] == "none"
