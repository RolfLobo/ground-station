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

import {store} from './store.jsx';
import L from 'leaflet';

export const MAP_ENGINE_LEAFLET = 'leaflet';
export const MAP_ENGINE_MAPLIBRE = 'maplibre';
export const MAP_ENGINE_MAPLIBRE_GLOBE = 'maplibre-globe';
export const mapEngines = [MAP_ENGINE_LEAFLET, MAP_ENGINE_MAPLIBRE, MAP_ENGINE_MAPLIBRE_GLOBE];

export const mapEngineOptions = [
    { id: MAP_ENGINE_LEAFLET, name: 'Leaflet' },
    { id: MAP_ENGINE_MAPLIBRE, name: 'MapLibre' },
];

export function normalizeMapEngine(mapEngine) {
    const normalizedMapEngine = String(mapEngine || '').trim().toLowerCase();
    if (normalizedMapEngine === MAP_ENGINE_MAPLIBRE || normalizedMapEngine === MAP_ENGINE_MAPLIBRE_GLOBE) {
        return normalizedMapEngine;
    }
    return MAP_ENGINE_LEAFLET;
}

export function normalizeMapEngineForTileLayers(mapEngine) {
    const normalizedMapEngine = normalizeMapEngine(mapEngine);
    // Globe mode reuses the same raster tile compatibility matrix as MapLibre 2D.
    return normalizedMapEngine === MAP_ENGINE_MAPLIBRE_GLOBE
        ? MAP_ENGINE_MAPLIBRE
        : normalizedMapEngine;
}

export function isTileLayerCompatibleWithEngine(layer, mapEngine) {
    const normalizedMapEngine = normalizeMapEngineForTileLayers(mapEngine);
    if (!layer || typeof layer !== 'object') {
        return false;
    }
    if (!Array.isArray(layer.engines) || layer.engines.length === 0) {
        // Legacy fallback: layers without metadata are assumed Leaflet-only.
        return normalizedMapEngine === MAP_ENGINE_LEAFLET;
    }
    return layer.engines.includes(normalizedMapEngine);
}

export function getTileLayersForEngine(mapEngine) {
    const normalizedMapEngine = normalizeMapEngineForTileLayers(mapEngine);
    return tileLayers.filter((layer) => isTileLayerCompatibleWithEngine(layer, normalizedMapEngine));
}

export function resolveCompatibleTileLayerId(id, mapEngine) {
    const compatibleLayers = getTileLayersForEngine(mapEngine);
    if (compatibleLayers.length === 0) {
        return 'satellite';
    }
    const requestedLayer = compatibleLayers.find((layer) => layer.id === id);
    if (requestedLayer) {
        return requestedLayer.id;
    }
    const defaultLayer = compatibleLayers.find((layer) => layer.id === 'satellite');
    return (defaultLayer || compatibleLayers[0]).id;
}


// Tile layers
export const tileLayers = [
    {
        id: 'osm',
        name: 'OpenStreetMap',
        description: 'Street map with roads, labels, and place details.',
        engines: [MAP_ENGINE_LEAFLET, MAP_ENGINE_MAPLIBRE],
        projection: 'EPSG3857',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    {
        id: 'satellite',
        name: 'Esri WorldImagery',
        description: 'Global satellite and aerial imagery basemap.',
        engines: [MAP_ENGINE_LEAFLET, MAP_ENGINE_MAPLIBRE],
        projection: 'EPSG3857',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    },
    {
        id: 'topo',
        name: 'Opentopomap topographic',
        description: 'Topographic style with terrain and contour emphasis.',
        engines: [MAP_ENGINE_LEAFLET, MAP_ENGINE_MAPLIBRE],
        projection: 'EPSG3857',
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    },
    {
        id: 'stadiadark',
        name: 'Stadia dark',
        description: 'Dark themed map for high-contrast overlays.',
        engines: [MAP_ENGINE_LEAFLET, MAP_ENGINE_MAPLIBRE],
        projection: 'EPSG3857',
        url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key={APIKEY}',
        attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    {
        id: 'cartodark',
        name: 'CARTO dark',
        description: 'Dark map tiles from CARTO basemaps.',
        engines: [MAP_ENGINE_LEAFLET, MAP_ENGINE_MAPLIBRE],
        projection: 'EPSG3857',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    {
        id: 'esrigreycanvas',
        name: 'Esri grey',
        description: 'Muted light-gray reference basemap.',
        engines: [MAP_ENGINE_LEAFLET, MAP_ENGINE_MAPLIBRE],
        projection: 'EPSG3857',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    },
    {
        id: 'cartodbvoyager',
        name: 'CartoDB Voyager',
        description: 'Balanced light basemap with roads and labels.',
        engines: [MAP_ENGINE_LEAFLET, MAP_ENGINE_MAPLIBRE],
        projection: 'EPSG3857',
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    {
        id: 'nasa_blue_marble_4326',
        name: 'NASA Blue Marble (EPSG:4326)',
        description: 'Global shaded relief and bathymetry.',
        engines: [MAP_ENGINE_LEAFLET],
        type: 'wms',
        projection: 'EPSG4326',
        url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
        wmsOptions: {
            layers: 'BlueMarble_ShadedRelief_Bathymetry',
            format: 'image/jpeg',
            transparent: false,
            version: '1.1.1',
        },
        attribution: 'Imagery courtesy NASA GIBS',
    },
    {
        id: 'nasa_osm_land_mask_4326',
        name: 'NASA OSM Land Mask (EPSG:4326)',
        description: 'Land mask layer derived from OSM features.',
        engines: [MAP_ENGINE_LEAFLET],
        type: 'wms',
        projection: 'EPSG4326',
        url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
        wmsOptions: {
            layers: 'OSM_Land_Mask',
            format: 'image/png',
            transparent: false,
            version: '1.1.1',
        },
        attribution: 'Data courtesy NASA GIBS',
    },
    {
        id: 'nasa_osm_land_water_map_4326',
        name: 'NASA OSM Land/Water Map (EPSG:4326)',
        description: 'Land and water reference map in geographic CRS.',
        engines: [MAP_ENGINE_LEAFLET],
        type: 'wms',
        projection: 'EPSG4326',
        url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
        wmsOptions: {
            layers: 'OSM_Land_Water_Map',
            format: 'image/png',
            transparent: false,
            version: '1.1.1',
        },
        attribution: 'Data courtesy NASA GIBS',
    }
];

/**
 * Function to get a tile layer by its id.
 * @param {string} id - The id of the tile layer to retrieve.
 * @returns {Object|null} - The tile layer object if found, otherwise null.
 */
export function getTileLayerById(id, options = {}) {
    const mapEngine = normalizeMapEngineForTileLayers(options.mapEngine);
    const compatibleLayerId = resolveCompatibleTileLayerId(id, mapEngine);
    const baseLayer = tileLayers.find(layer => layer.id === compatibleLayerId);
    const fallbackLayerId = resolveCompatibleTileLayerId('satellite', mapEngine);
    const fallbackLayer = tileLayers.find(layer => layer.id === fallbackLayerId) || tileLayers[0] || {};
    const tileLayer = {
        ...((baseLayer && baseLayer.id) ? baseLayer : fallbackLayer),
        wmsOptions: { ...(baseLayer?.wmsOptions || fallbackLayer?.wmsOptions || {}) },
    };

    if (tileLayer.id === 'stadiadark') {
        const state = store.getState();
        const preferences = state.preferences.preferences;
        const apiKey = preferences.find(pref => pref.name === "stadia_maps_api_key");
        if (apiKey) {
            tileLayer.url = tileLayer.url.replace("{APIKEY}", apiKey.value);
        }
    }

    return tileLayer;
}

export function getMapCrsByTileLayerId(id, options = {}) {
    const tileLayer = getTileLayerById(id, options);
    if (tileLayer.projection === 'EPSG4326') {
        return L.CRS.EPSG4326;
    }

    return L.CRS.EPSG3857;
}

export function getMapLibreTileURL(id, options = {}) {
    const tileLayer = getTileLayerById(id, options);
    // MapLibre style templates do not support Leaflet placeholders like {s}/{r}.
    return String(tileLayer?.url || '')
        .replaceAll('{s}', 'a')
        .replaceAll('{r}', '');
}
