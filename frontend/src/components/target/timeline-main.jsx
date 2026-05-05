import React from 'react';
import { useSelector } from 'react-redux';
import PassTimeline from '../passes/timeline/pass-timeline.jsx';

const TargetPassTimelineComponent = (props) => {
    const satellitePasses = useSelector((state) => state.targetSatTrack.satellitePasses);
    const activePass = useSelector((state) => state.targetSatTrack.activePass);
    const gridEditable = useSelector((state) => state.targetSatTrack.gridEditable);
    const trackerInstances = useSelector((state) => state.trackerInstances?.instances || []);
    const groundStationLocation = useSelector((state) => state.location.location);
    const timezone = useSelector(
        (state) => {
            const timezonePref = state.preferences.preferences.find((pref) => pref.name === 'timezone');
            return timezonePref ? timezonePref.value : 'UTC';
        },
        (prev, next) => prev === next,
    );

    return (
        <PassTimeline
            {...props}
            passes={satellitePasses}
            activePass={activePass}
            gridEditable={gridEditable}
            groundStationLocation={groundStationLocation}
            timezone={timezone}
            noTargetsConfigured={trackerInstances.length === 0}
        />
    );
};

export const SatellitePassTimeline = React.memo(TargetPassTimelineComponent);

export default SatellitePassTimeline;
