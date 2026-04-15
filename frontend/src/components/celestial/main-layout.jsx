import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { Responsive, useContainerWidth } from 'react-grid-layout';
import { absoluteStrategy } from 'react-grid-layout/core';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useSocket } from '../common/socket.jsx';
import {
    getClassNamesBasedOnGridEditing,
    StyledIslandParentNoScrollbar,
    TitleBar,
} from '../common/common.jsx';
import {
    fetchCelestialScene,
    getCelestialMapSettings,
    refreshMonitoredCelestialNow,
    setCelestialMapSettings,
} from './celestial-slice.jsx';
import { fetchMonitoredCelestial } from './monitored-slice.jsx';
import CelestialToolbar from './celestial-toolbar.jsx';
import CelestialStatusBar from './celestial-statusbar.jsx';
import SolarSystemCanvas from './solarsystem-canvas.jsx';
import CelestialTopBar from './celestial-topbar.jsx';

const gridLayoutStoreName = 'celestial-layouts';
const SHARED_RESIZE_HANDLES = ['s', 'sw', 'w', 'se', 'nw', 'ne', 'e'];

function loadLayoutsFromLocalStorage() {
    try {
        const raw = localStorage.getItem(gridLayoutStoreName);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveLayoutsToLocalStorage(layouts) {
    localStorage.setItem(gridLayoutStoreName, JSON.stringify(layouts));
}

function normalizeLayoutsResizeHandles(layouts) {
    if (!layouts || typeof layouts !== 'object') {
        return layouts;
    }

    return Object.fromEntries(
        Object.entries(layouts).map(([breakpoint, items]) => [
            breakpoint,
            Array.isArray(items)
                ? items.map((item) => ({
                    ...item,
                    resizeHandles: [...SHARED_RESIZE_HANDLES],
                }))
                : items,
        ]),
    );
}

const defaultLayouts = {
    lg: [{ i: 'solar-system', x: 0, y: 0, w: 12, h: 24, resizeHandles: [...SHARED_RESIZE_HANDLES] }],
    md: [{ i: 'solar-system', x: 0, y: 0, w: 10, h: 24, resizeHandles: [...SHARED_RESIZE_HANDLES] }],
    sm: [{ i: 'solar-system', x: 0, y: 0, w: 6, h: 20, resizeHandles: [...SHARED_RESIZE_HANDLES] }],
    xs: [{ i: 'solar-system', x: 0, y: 0, w: 2, h: 18, resizeHandles: [...SHARED_RESIZE_HANDLES] }],
    xxs: [{ i: 'solar-system', x: 0, y: 0, w: 2, h: 18, resizeHandles: [...SHARED_RESIZE_HANDLES] }],
};

const CelestialMainLayout = () => {
    const dispatch = useDispatch();
    const { socket } = useSocket();
    const isEditing = useSelector((state) => state.dashboard?.isEditing);
    const celestialState = useSelector((state) => state.celestial);
    const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });

    const [layouts, setLayouts] = useState(() => {
        const loaded = loadLayoutsFromLocalStorage();
        return normalizeLayoutsResizeHandles(loaded ?? defaultLayouts);
    });
    const [fitAllSignal, setFitAllSignal] = useState(0);

    const handleLayoutsChange = (currentLayout, allLayouts) => {
        const normalizedLayouts = normalizeLayoutsResizeHandles(allLayouts);
        setLayouts(normalizedLayouts);
        saveLayoutsToLocalStorage(normalizedLayouts);
    };

    useEffect(() => {
        if (!socket) return;
        dispatch(fetchCelestialScene({ socket }));
        dispatch(getCelestialMapSettings({ socket }));
    }, [socket, dispatch]);

    const handleViewportCommit = React.useCallback((nextViewport) => {
        if (!socket) return;

        const existing = celestialState.mapSettings || {};
        const prev = existing.solarSystemViewport || {};
        const unchanged =
            Number(prev.zoom) === Number(nextViewport.zoom)
            && Number(prev.panX) === Number(nextViewport.panX)
            && Number(prev.panY) === Number(nextViewport.panY);

        if (unchanged) return;

        dispatch(
            setCelestialMapSettings({
                socket,
                value: {
                    ...existing,
                    solarSystemViewport: nextViewport,
                },
            }),
        );
    }, [socket, celestialState.mapSettings, dispatch]);

    const planetsCount = celestialState.scene?.planets?.length || 0;
    const trackedCount = celestialState.scene?.celestial?.length || 0;

    const gridContents = [
        <StyledIslandParentNoScrollbar key="solar-system">
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <TitleBar className={getClassNamesBasedOnGridEditing(isEditing, [])}>
                    Solar System Layout
                </TitleBar>
                <CelestialToolbar
                    onFitAll={() => setFitAllSignal((value) => value + 1)}
                    onRefresh={async () => {
                        if (!socket) return;
                        await dispatch(refreshMonitoredCelestialNow({ socket }));
                        await dispatch(fetchMonitoredCelestial({ socket }));
                    }}
                    loading={celestialState.loading}
                    disabled={!socket}
                />
                <Box sx={{ p: 0, flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
                    {celestialState.loading ? (
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 1, position: 'absolute', zIndex: 2 }}>
                            <CircularProgress size={18} />
                        </Stack>
                    ) : null}
                    {celestialState.error ? (
                        <Typography variant="body2" color="error" sx={{ p: 1 }}>
                            {celestialState.error}
                        </Typography>
                    ) : (
                        <Box sx={{ height: '100%', minHeight: 220 }}>
                            <SolarSystemCanvas
                                scene={celestialState.scene}
                                fitAllSignal={fitAllSignal}
                                initialViewport={celestialState.mapSettings?.solarSystemViewport}
                                onViewportCommit={handleViewportCommit}
                            />
                        </Box>
                    )}
                </Box>
                <CelestialStatusBar planetsCount={planetsCount} trackedCount={trackedCount} />
            </Box>
        </StyledIslandParentNoScrollbar>,
    ];

    return (
        <Box sx={{ width: '100%', height: '100%' }}>
            <CelestialTopBar />
            <div ref={containerRef}>
                {mounted ? (
                    <Responsive
                        width={width}
                        positionStrategy={absoluteStrategy}
                        className="layout"
                        layouts={layouts}
                        onLayoutChange={handleLayoutsChange}
                        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                        cols={{ lg: 12, md: 10, sm: 6, xs: 2, xxs: 2 }}
                        rowHeight={30}
                        dragConfig={{ enabled: isEditing, handle: '.react-grid-draggable' }}
                        resizeConfig={{ enabled: isEditing }}
                    >
                        {gridContents}
                    </Responsive>
                ) : null}
            </div>
        </Box>
    );
};

export default CelestialMainLayout;
