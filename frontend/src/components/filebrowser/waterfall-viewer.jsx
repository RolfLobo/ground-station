/**
 * @license
 * Copyright (c) 2025 Efstratios Goudelis
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DownloadIcon from '@mui/icons-material/Download';
import FrequencyScale from '../waterfall/frequency-scale.jsx';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const WHEEL_ZOOM_STEP = 0.35;
const SCALE_STRIP_HEIGHT = 20;

export default function WaterfallViewer({
    src,
    alt,
    centerFrequency,
    sampleRate,
    startTime,
    endTime,
    formatDate,
    formatFrequency,
    minZoom = 1,
    maxZoom = 20,
    containerSx,
    hintDurationMs = 2800,
}) {
    const containerRef = useRef(null);
    const activePointerIdRef = useRef(null);
    const isDraggingRef = useRef(false);
    const lastPointerXRef = useRef(0);
    const scaleRef = useRef(1);
    const positionXRef = useRef(0);

    const [scaleX, setScaleX] = useState(1);
    const [positionX, setPositionX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [showHint, setShowHint] = useState(true);
    const [cursorInfo, setCursorInfo] = useState(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [transformTick, setTransformTick] = useState(0);

    const formatFrequencyValue = useCallback(
        (frequencyHz) => {
            if (!Number.isFinite(frequencyHz)) return '';
            if (typeof formatFrequency === 'function') {
                return formatFrequency(frequencyHz);
            }
            if (frequencyHz >= 1e9) {
                return `${(frequencyHz / 1e9).toFixed(6)} GHz`;
            }
            if (frequencyHz >= 1e6) {
                return `${(frequencyHz / 1e6).toFixed(6)} MHz`;
            }
            if (frequencyHz >= 1e3) {
                return `${(frequencyHz / 1e3).toFixed(3)} kHz`;
            }
            return `${frequencyHz.toFixed(0)} Hz`;
        },
        [formatFrequency]
    );

    const formatDateValue = useCallback(
        (isoDate) => {
            if (!isoDate) return '';
            if (typeof formatDate === 'function') {
                return formatDate(isoDate);
            }
            return new Date(isoDate).toLocaleString();
        },
        [formatDate]
    );

    const applyTransform = useCallback((nextScale, nextPositionX) => {
        scaleRef.current = nextScale;
        positionXRef.current = nextPositionX;
        setScaleX(nextScale);
        setPositionX(nextPositionX);
        // Keep frequency scale labels in sync with the transformed (zoomed) width.
        setTransformTick((tick) => tick + 1);
    }, []);

    const clampPositionForScale = useCallback(
        (candidate, nextScale) => {
            if (!Number.isFinite(containerSize.width) || containerSize.width <= 0 || nextScale <= 1) {
                return 0;
            }
            const maxPanLeft = containerSize.width - containerSize.width * nextScale;
            return clamp(candidate, maxPanLeft, 0);
        },
        [containerSize.width]
    );

    const buildCursorInfo = useCallback(
        (clientX, clientY) => {
            const container = containerRef.current;
            if (!container || !containerSize.width || !containerSize.height) {
                return null;
            }

            const rect = container.getBoundingClientRect();
            const localX = clientX - rect.left;
            const localY = clientY - rect.top;

            const imageViewportHeight = Math.max(1, containerSize.height - SCALE_STRIP_HEIGHT);
            if (localY < SCALE_STRIP_HEIGHT || localY > containerSize.height) {
                return null;
            }

            // Mirror live waterfall behavior: full-bleed render with X-only transform.
            const transformedWidth = containerSize.width * scaleRef.current;
            const normalizedX = (localX - positionXRef.current) / transformedWidth;
            const normalizedY = (localY - SCALE_STRIP_HEIGHT) / imageViewportHeight;

            if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) {
                return null;
            }

            let frequency = null;
            if (Number.isFinite(centerFrequency) && Number.isFinite(sampleRate)) {
                const startFreq = centerFrequency - sampleRate / 2;
                frequency = startFreq + normalizedX * sampleRate;
            }

            let timeLabel = '';
            if (startTime && endTime) {
                const startMs = new Date(startTime).getTime();
                const endMs = new Date(endTime).getTime();
                if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs >= startMs) {
                    const timeMs = startMs + normalizedY * (endMs - startMs);
                    timeLabel = formatDateValue(new Date(timeMs).toISOString());
                }
            }

            return {
                x: localX,
                y: localY,
                frequency,
                timeLabel,
            };
        },
        [centerFrequency, containerSize.height, containerSize.width, endTime, formatDateValue, sampleRate, startTime]
    );

    const zoomOnXAxisOnly = useCallback(
        (deltaScale, centerX) => {
            if (!Number.isFinite(containerSize.width) || containerSize.width <= 0) {
                return;
            }

            const previousScale = scaleRef.current;
            const nextScale = clamp(previousScale + deltaScale, minZoom, maxZoom);

            if (nextScale === previousScale) {
                return;
            }

            const safeCenterX = clamp(centerX, 0, containerSize.width);
            const pointRatio =
                (safeCenterX - positionXRef.current) / (containerSize.width * previousScale);

            let nextPositionX = safeCenterX - pointRatio * containerSize.width * nextScale;
            if (nextScale === 1) {
                nextPositionX = 0;
            } else {
                nextPositionX = clampPositionForScale(nextPositionX, nextScale);
            }

            applyTransform(nextScale, nextPositionX);
        },
        [applyTransform, clampPositionForScale, containerSize.width, maxZoom, minZoom]
    );

    const panOnXAxisOnly = useCallback(
        (deltaX) => {
            if (scaleRef.current <= 1) {
                return;
            }
            const nextPositionX = clampPositionForScale(positionXRef.current + deltaX, scaleRef.current);
            applyTransform(scaleRef.current, nextPositionX);
        },
        [applyTransform, clampPositionForScale]
    );

    const resetTransform = useCallback(() => {
        applyTransform(1, 0);
    }, [applyTransform]);

    const handleDownloadSnapshot = useCallback(() => {
        if (!src) return;
        window.open(src, '_blank');
    }, [src]);

    const handleWheel = useCallback(
        (event) => {
            if (!src) return;
            event.preventDefault();
            event.stopPropagation();
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const localX = event.clientX - rect.left;

            // Normalize wheel units across browsers/devices:
            // deltaMode 0=pixel, 1=line, 2=page.
            let normalizedDeltaY = event.deltaY;
            if (event.deltaMode === 1) {
                normalizedDeltaY *= 16;
            } else if (event.deltaMode === 2) {
                normalizedDeltaY *= 120;
            }

            // Use a fixed step so zoom is clearly visible on all devices.
            // Scroll-down zooms out; scroll-up zooms in.
            const direction = normalizedDeltaY >= 0 ? -1 : 1;
            const deltaScale = direction * WHEEL_ZOOM_STEP;

            zoomOnXAxisOnly(deltaScale, localX);
            setCursorInfo(buildCursorInfo(event.clientX, event.clientY));
            setShowHint(false);
        },
        [buildCursorInfo, src, zoomOnXAxisOnly]
    );

    const handlePointerDown = useCallback(
        (event) => {
            if (!src) return;
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            if (event.pointerType !== 'touch' && event.cancelable) {
                event.preventDefault();
            }
            event.currentTarget.setPointerCapture(event.pointerId);
            activePointerIdRef.current = event.pointerId;
            lastPointerXRef.current = event.clientX;
            setCursorInfo(buildCursorInfo(event.clientX, event.clientY));
            setShowHint(false);
            if (scaleRef.current > 1) {
                isDraggingRef.current = true;
                setIsDragging(true);
            }
        },
        [buildCursorInfo, src]
    );

    const handlePointerMove = useCallback(
        (event) => {
            if (!src) return;

            if (activePointerIdRef.current === event.pointerId && isDraggingRef.current) {
                // Browser image/selection drags can steal the gesture if a frame stalls mid-pan.
                if (event.cancelable) {
                    event.preventDefault();
                }
                const deltaX = event.clientX - lastPointerXRef.current;
                lastPointerXRef.current = event.clientX;
                panOnXAxisOnly(deltaX);
            }

            setCursorInfo(buildCursorInfo(event.clientX, event.clientY));
        },
        [buildCursorInfo, panOnXAxisOnly, src]
    );

    const handlePointerUp = useCallback((event) => {
        if (activePointerIdRef.current === event.pointerId) {
            activePointerIdRef.current = null;
            isDraggingRef.current = false;
            setIsDragging(false);
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    }, []);

    const handleDragStart = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
    }, []);

    const visibleFrequencyRange = useMemo(() => {
        if (!Number.isFinite(centerFrequency) || !Number.isFinite(sampleRate)) return null;
        if (!containerSize.width) return null;

        const transformedWidth = containerSize.width * scaleX;
        if (transformedWidth <= 0) return null;

        const visibleStartNorm = clamp((0 - positionX) / transformedWidth, 0, 1);
        const visibleEndNorm = clamp((containerSize.width - positionX) / transformedWidth, 0, 1);

        const fullStartFrequency = centerFrequency - sampleRate / 2;
        return {
            start: fullStartFrequency + visibleStartNorm * sampleRate,
            end: fullStartFrequency + visibleEndNorm * sampleRate,
        };
    }, [centerFrequency, containerSize.width, positionX, sampleRate, scaleX]);

    useEffect(() => {
        if (!containerRef.current) return undefined;

        const updateContainerSize = () => {
            const rect = containerRef.current.getBoundingClientRect();
            setContainerSize({
                width: rect.width,
                height: rect.height,
            });
        };

        updateContainerSize();
        const observer = new ResizeObserver(updateContainerSize);
        observer.observe(containerRef.current);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        // Use a non-passive listener so preventDefault reliably blocks dialog/page scrolling.
        const onWheel = (event) => {
            handleWheel(event);
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', onWheel);
        };
    }, [handleWheel]);

    useEffect(() => {
        const clamped = clampPositionForScale(positionXRef.current, scaleRef.current);
        if (clamped !== positionXRef.current) {
            applyTransform(scaleRef.current, clamped);
        }
    }, [applyTransform, clampPositionForScale, containerSize.width]);

    useEffect(() => {
        applyTransform(1, 0);
        isDraggingRef.current = false;
        setIsDragging(false);
        setCursorInfo(null);
        setShowHint(true);
    }, [applyTransform, src]);

    useEffect(() => {
        if (!showHint) return undefined;
        const timer = setTimeout(() => setShowHint(false), hintDurationMs);
        return () => clearTimeout(timer);
    }, [hintDurationMs, showHint]);

    const containerCursor = scaleX > 1 ? (isDragging ? 'grabbing' : 'grab') : 'crosshair';

    return (
        <Box
            data-testid="waterfall-viewer"
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={() => setCursorInfo(null)}
            onDragStart={handleDragStart}
            draggable={false}
            sx={{
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.5,
                bgcolor: '#05070b',
                touchAction: 'pan-y',
                cursor: containerCursor,
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitUserDrag: 'none',
                ...containerSx,
            }}
        >
            <Box
                draggable={false}
                sx={{
                    position: 'absolute',
                    inset: 0,
                    transformOrigin: 'left center',
                    transform: `translateX(${positionX}px) scaleX(${scaleX})`,
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitUserDrag: 'none',
                }}
            >
                <Box sx={{ height: `${SCALE_STRIP_HEIGHT}px`, width: '100%' }}>
                    <FrequencyScale
                        centerFrequency={centerFrequency}
                        sampleRate={sampleRate}
                        containerWidth={containerSize.width || 1}
                        transformTick={transformTick}
                        canvasHeight={SCALE_STRIP_HEIGHT}
                    />
                </Box>
                <img
                    src={src}
                    alt={alt}
                    draggable={false}
                    onDragStart={handleDragStart}
                    style={{
                        width: '100%',
                        height: `calc(100% - ${SCALE_STRIP_HEIGHT}px)`,
                        display: 'block',
                        objectFit: 'fill',
                        imageRendering: 'auto',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitUserDrag: 'none',
                        pointerEvents: 'none',
                    }}
                />
            </Box>

            {cursorInfo && (
                <>
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: cursorInfo.x,
                            width: '1px',
                            bgcolor: 'rgba(255, 255, 255, 0.5)',
                            pointerEvents: 'none',
                        }}
                    />
                    <Box
                        sx={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: cursorInfo.y,
                            height: '1px',
                            bgcolor: 'rgba(255, 255, 255, 0.5)',
                            pointerEvents: 'none',
                        }}
                    />
                    {cursorInfo.frequency !== null && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 8,
                                left: cursorInfo.x,
                                transform: 'translateX(-50%)',
                                px: 1,
                                py: 0.4,
                                borderRadius: 1,
                                bgcolor: 'rgba(0, 0, 0, 0.7)',
                                color: 'common.white',
                                fontSize: '0.7rem',
                                letterSpacing: '0.02em',
                                pointerEvents: 'none',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {formatFrequencyValue(cursorInfo.frequency)}
                        </Box>
                    )}
                    {cursorInfo.timeLabel && (
                        <Box
                            sx={{
                                position: 'absolute',
                                left: 8,
                                top: cursorInfo.y,
                                transform: 'translateY(-50%)',
                                px: 1,
                                py: 0.4,
                                borderRadius: 1,
                                bgcolor: 'rgba(0, 0, 0, 0.7)',
                                color: 'common.white',
                                fontSize: '0.7rem',
                                letterSpacing: '0.02em',
                                pointerEvents: 'none',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {cursorInfo.timeLabel}
                        </Box>
                    )}
                </>
            )}

            <Box
                onPointerDown={(event) => event.stopPropagation()}
                onPointerMove={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
                onPointerCancel={(event) => event.stopPropagation()}
                onWheel={(event) => event.stopPropagation()}
                sx={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    zIndex: 2,
                }}
            >
                <Tooltip title="Zoom Out X">
                    <IconButton
                        size="small"
                        onClick={() => zoomOnXAxisOnly(-0.5, containerSize.width / 2)}
                        sx={{
                            bgcolor: 'rgba(0, 0, 0, 0.55)',
                            color: 'common.white',
                            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.72)' },
                        }}
                    >
                        <ZoomOutIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Zoom In X">
                    <IconButton
                        size="small"
                        onClick={() => zoomOnXAxisOnly(0.5, containerSize.width / 2)}
                        sx={{
                            bgcolor: 'rgba(0, 0, 0, 0.55)',
                            color: 'common.white',
                            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.72)' },
                        }}
                    >
                        <ZoomInIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Reset View">
                    <IconButton
                        size="small"
                        onClick={resetTransform}
                        sx={{
                            bgcolor: 'rgba(0, 0, 0, 0.55)',
                            color: 'common.white',
                            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.72)' },
                        }}
                    >
                        <RestartAltIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Download Snapshot">
                    <IconButton
                        size="small"
                        onClick={handleDownloadSnapshot}
                        sx={{
                            bgcolor: 'rgba(0, 0, 0, 0.55)',
                            color: 'common.white',
                            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.72)' },
                        }}
                    >
                        <DownloadIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>

            <Box
                sx={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    bgcolor: 'rgba(0, 0, 0, 0.55)',
                    color: 'common.white',
                    fontSize: '0.72rem',
                    letterSpacing: '0.02em',
                    pointerEvents: 'none',
                }}
            >
                <Typography component="span" sx={{ fontSize: 'inherit' }}>
                    {`Zoom ${scaleX.toFixed(1)}x`}
                </Typography>
                {visibleFrequencyRange && (
                    <Typography component="span" sx={{ fontSize: 'inherit', ml: 1 }}>
                        {`${formatFrequencyValue(visibleFrequencyRange.start)} - ${formatFrequencyValue(visibleFrequencyRange.end)}`}
                    </Typography>
                )}
            </Box>

            {showHint && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        bgcolor: 'rgba(0, 0, 0, 0.6)',
                        color: 'common.white',
                        fontSize: '0.7rem',
                        letterSpacing: '0.02em',
                        pointerEvents: 'none',
                    }}
                >
                    Scroll to zoom X axis, drag to pan
                </Box>
            )}
        </Box>
    );
}
