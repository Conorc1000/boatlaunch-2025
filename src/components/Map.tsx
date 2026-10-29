import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import { ref, get } from 'firebase/database';
import { database } from '../firebase';
import { OsmSlipway, Slipway } from '../types/Slipway';
import { osmToSlipway } from '../services/osmToSlipway';
import { useAuth } from '../hooks/useAuth';
import SlipwayView from './SlipwayView';
import {
    SearchIcon, FilterIcon, PlusIcon, XIcon, PinIcon, LocateIcon, CameraIcon,
    AlertIcon, MapIcon, ChevronRightIcon, CheckIcon, StreetViewIcon, LayersIcon
} from './Icons';
import 'leaflet/dist/leaflet.css';

const pinSvg = (fill: string, stroke: string, inner: string) =>
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40">
            <path fill="${fill}" stroke="${stroke}" stroke-width="1.5" d="M14 1C7 1 1.5 6.5 1.5 13.5 1.5 23 14 38.5 14 38.5S26.5 23 26.5 13.5C26.5 6.5 21 1 14 1Z"/>
            ${inner}
        </svg>
    `);

const iconDefault = L.icon({
    iconUrl: pinSvg('#64748b', '#ffffff', '<circle fill="#ffffff" cx="14" cy="13.5" r="4.5"/>'),
    iconSize: [24, 34],
    iconAnchor: [12, 33],
    popupAnchor: [0, -29],
    tooltipAnchor: [12, -22]
});

// Slipways with photos use the brand colour and a small camera glyph
const iconWithPhotos = L.icon({
    iconUrl: pinSvg('#0e7490', '#ffffff', `
        <rect fill="#ffffff" x="7.5" y="9" width="13" height="9.5" rx="2"/>
        <rect fill="#ffffff" x="11" y="7.2" width="6" height="2.5" rx="1"/>
        <circle fill="#0e7490" cx="14" cy="13.8" r="2.6"/>
    `),
    iconSize: [24, 34],
    iconAnchor: [12, 33],
    popupAnchor: [0, -29],
    tooltipAnchor: [12, -22]
});

// Admin-only OpenStreetMap imports: amber with a diamond so they can't be mistaken for Boatlaunch slipways
const iconOsm = L.icon({
    iconUrl: pinSvg('#d97706', '#ffffff', '<path fill="#ffffff" d="M14 8.5 19 13.5 14 18.5 9 13.5Z"/>'),
    iconSize: [24, 34],
    iconAnchor: [12, 33],
    popupAnchor: [0, -29],
    tooltipAnchor: [12, -22]
});

L.Marker.prototype.options.icon = iconDefault;

interface MapProps {
    onNavigate?: (view: string, data?: any) => void;
    centerOnSlipway?: { id: string; latitude: number; longitude: number; name: string } | null;
}

// Component to handle map clicks for adding new slipways
const MapClickHandler: React.FC<{ onMapClick: (lat: number, lng: number) => void }> = ({ onMapClick }) => {
    useMapEvents({
        click: (e: any) => {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
};

// Component to handle map updates and centering
const MapUpdater: React.FC<{ centerOnSlipway: any; onCenterComplete: () => void }> = ({ centerOnSlipway, onCenterComplete }) => {
    const map: any = useMap();
    const onCompleteRef = useRef(onCenterComplete);
    onCompleteRef.current = onCenterComplete;

    // Only re-centre when a new target arrives, not on every parent render
    useEffect(() => {
        if (centerOnSlipway) {
            map.setView([centerOnSlipway.latitude, centerOnSlipway.longitude], 15);

            // Clear after animation
            const timer = setTimeout(() => {
                onCompleteRef.current();
            }, 1500);

            return () => clearTimeout(timer);
        }
    }, [centerOnSlipway, map]);

    return null;
};

// Exposes the Leaflet map instance to the parent component
const MapBridge: React.FC<{ onReady: (map: any) => void }> = ({ onReady }) => {
    const map: any = useMap();
    useEffect(() => {
        onReady(map);
    }, [map, onReady]);
    return null;
};

type LatLng = { latitude: number; longitude: number };

// Opens the location in Google Maps, where the user can choose directions, satellite view, etc.
const googleMapsUrl = (s: LatLng) =>
    `https://www.google.com/maps/search/?api=1&query=${s.latitude},${s.longitude}`;

// Opens Google Street View at the nearest available panorama
const streetViewUrl = (s: LatLng) =>
    `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${s.latitude},${s.longitude}`;

const hasValue = (v?: string) => !!v && v.trim() !== '' && v !== 'Unknown';

// Charges are free text, so bucket them into broad categories for filtering
type ChargeCategory = 'free' | 'paid' | 'licence' | 'unknown';
const chargeCategory = (charges?: string): ChargeCategory => {
    const c = (charges || '').trim().toLowerCase();
    if (!c || /^(unknown|not known|\?|n\/a|see website)/.test(c)) return 'unknown';
    if (/^(none|free|nil|no charges?|no fee|£?0(\.00)?\b)/.test(c)) return 'free';
    if (/licen[cs]e|toll|registration/.test(c)) return 'licence';
    if (/£|\d|fee|pay|dues|charge|ticket|permit|pass|yes|donation|honesty box|membership|nominal/.test(c)) return 'paid';
    if (/\bfree\b|none for|never anyone to take money/.test(c)) return 'free';
    return 'unknown';
};

const CHARGE_OPTIONS: { value: ChargeCategory; label: string }[] = [
    { value: 'free', label: 'Free' },
    { value: 'paid', label: 'Launch fee' },
    { value: 'licence', label: 'Licence / toll' },
    { value: 'unknown', label: 'Not known' },
];

const Map: React.FC<MapProps> = ({ onNavigate, centerOnSlipway }) => {
    const [slipways, setSlipways] = useState<Slipway[]>([]);
    const [filteredSlipways, setFilteredSlipways] = useState<Slipway[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSlipway, setSelectedSlipway] = useState<Slipway | null>(null);
    const [rampLengthFilter, setRampLengthFilter] = useState<string>('');
    const [suitabilityFilter, setSuitabilityFilter] = useState<string>('');
    const [chargesFilter, setChargesFilter] = useState<ChargeCategory[]>([]);
    const [photosOnly, setPhotosOnly] = useState<boolean>(false);
    const [showFilters, setShowFilters] = useState<boolean>(false);
    const [addSlipwayMode, setAddSlipwayMode] = useState<boolean>(false);
    const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);
    const [showOsm, setShowOsm] = useState<boolean>(true);
    const [osmSlipways, setOsmSlipways] = useState<OsmSlipway[] | null>(null);
    const [osmLoading, setOsmLoading] = useState<boolean>(false);
    const [osmError, setOsmError] = useState<string | null>(null);
    const [osmUnavailable, setOsmUnavailable] = useState<boolean>(false);

    const { user } = useAuth();
    const osmVisible = showOsm && !osmUnavailable;
    const osmAsSlipways = useMemo(() => (osmSlipways || []).map(osmToSlipway), [osmSlipways]);
    // Boatlaunch slipways plus unverified OSM imports; filters and search apply to both
    const allSlipways = useMemo(
        () => (osmVisible ? [...slipways, ...osmAsSlipways] : slipways),
        [slipways, osmAsSlipways, osmVisible]
    );

    // OSM imports load separately so switching them off skips the extra download
    useEffect(() => {
        if (!osmVisible || osmSlipways || osmLoading || osmError) return;
        setOsmLoading(true);
        setOsmError(null);
        get(ref(database, 'osmSlipways'))
            .then((snapshot) => {
                const value = snapshot.val() || {};
                setOsmSlipways(Object.entries(value).map(([id, s]: [string, any]) => ({ id, ...s })));
            })
            .catch((err) => {
                console.error('Failed to load OSM slipways:', err);
                if (String(err?.message || err).includes('ermission')) {
                    // The database rules don't allow this visitor to read them: quietly leave them off the map
                    setOsmUnavailable(true);
                } else {
                    setOsmError('Could not load OpenStreetMap slipways');
                    setShowOsm(false);
                }
            })
            .finally(() => setOsmLoading(false));
    }, [osmVisible, osmSlipways, osmLoading, osmError]);

    // Handle map click for adding new slipway
    const handleMapClick = (lat: number, lng: number) => {
        if (addSlipwayMode && onNavigate) {
            onNavigate('addSlipway', { latitude: lat, longitude: lng });
            setAddSlipwayMode(false);
        }
    };

    // Helper function to truncate long text
    const truncateText = (text: string, maxLength: number = 200): string => {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    // Fetch slipways from Firebase
    useEffect(() => {
        console.log('Map component mounted, fetching slipways...');

        const fetchSlipways = async () => {
            try {
                setDataLoading(true);
                console.log('Starting to fetch slipway data...');

                // Try to fetch from a single optimized endpoint first
                const startTime = performance.now();

                // Option 1: Try to fetch combined data if available
                const combinedRef = ref(database, 'slipways');
                let latLngsSnapshot, detailsSnapshot;

                try {
                    // Force fresh data by adding timestamp to avoid cache
                    const combinedSnapshot = await get(combinedRef);
                    if (combinedSnapshot.exists()) {
                        console.log('Using optimized combined slipways data');
                        // Handle combined data structure here if it exists
                        const combinedData = combinedSnapshot.val();
                        const fetchTime = performance.now() - startTime;
                        console.log(`Optimized Firebase fetch completed in ${fetchTime.toFixed(2)}ms`);

                        // Process combined data differently
                        const slipwayData: Slipway[] = Object.keys(combinedData).map(slipwayId => {
                            const data = combinedData[slipwayId];
                            return {
                                id: slipwayId,
                                name: data.name || data.Name || 'Unknown',
                                description: data.description || data.Description || 'No description available',
                                latitude: data.latitude || parseFloat(data.coords?.[0]) || 0,
                                longitude: data.longitude || parseFloat(data.coords?.[1]) || 0,
                                facilities: data.facilities || (data.Facilities ? data.Facilities.split(', ').filter((f: string) => f.trim()) : []),
                                imgs: data.imgs || data.ImageIds || [],
                                createdBy: data.createdBy,
                                createdAt: data.createdAt,
                                updatedBy: data.updatedBy,
                                updatedAt: data.updatedAt,
                                charges: data.charges || data.Charges || 'Unknown',
                                nearestPlace: data.nearestPlace || data.NearestPlace || 'Unknown',
                                rampType: data.rampType || data.RampType || 'Unknown',
                                suitability: data.suitability || data.Suitability || 'Unknown',
                                directions: data.directions || data.Directions || '',
                                email: data.email || data.Email || '',
                                lowerArea: data.lowerArea || data.LowerArea || '',
                                mobilePhoneNumber: data.mobilePhoneNumber || data.MobilePhoneNumber || '',
                                navigationalHazards: data.navigationalHazards || data.NavigationalHazards || '',
                                rampDescription: data.rampDescription || data.RampDescription || '',
                                rampLength: data.rampLength || data.RampLength || '',
                                upperArea: data.upperArea || data.UpperArea || '',
                                website: data.website || data.Website || ''
                            };
                        }).filter(slipway => slipway.latitude && slipway.longitude);

                        setSlipways(slipwayData);
                        setFilteredSlipways(slipwayData);
                        setError(null);
                        console.log(`Successfully loaded ${slipwayData.length} slipways from optimized endpoint`);
                        return; // Exit early if combined data worked
                    }
                } catch (combinedError) {
                    console.log('Combined endpoint not available, falling back to separate queries');
                }

                // Option 2: Fallback to separate queries with limited data
                console.log('Fetching from separate latLngs and slipwayDetails endpoints...');
                const latLngsRef = ref(database, 'latLngs');
                const slipwayDetailsRef = ref(database, 'slipwayDetails');

                [latLngsSnapshot, detailsSnapshot] = await Promise.all([
                    get(latLngsRef),
                    get(slipwayDetailsRef)
                ]);
                const fetchTime = performance.now() - startTime;
                console.log(`Firebase fetch completed in ${fetchTime.toFixed(2)}ms`);
                console.log(`Data sizes - latLngs: ${JSON.stringify(latLngsSnapshot.val()).length} chars, details: ${JSON.stringify(detailsSnapshot.val()).length} chars`);

                if (latLngsSnapshot.exists() && detailsSnapshot.exists()) {
                    const latLngsData = latLngsSnapshot.val();
                    const detailsData = detailsSnapshot.val();

                    console.log(`Processing ${Object.keys(latLngsData).length} slipway records...`);

                    // Use requestIdleCallback for non-blocking processing
                    const processData = () => {
                        return new Promise<Slipway[]>((resolve) => {
                            const slipwayData: Slipway[] = [];
                            const slipwayIds = Object.keys(latLngsData);
                            let processedCount = 0;

                            const processBatch = () => {
                                const batchSize = 50; // Process 50 items at a time
                                const endIndex = Math.min(processedCount + batchSize, slipwayIds.length);

                                for (let i = processedCount; i < endIndex; i++) {
                                    const slipwayId = slipwayIds[i];
                                    const coords = latLngsData[slipwayId];
                                    const details = detailsData[slipwayId];

                                    if (coords && details && coords.length >= 2) {
                                        const slipway: Slipway = {
                                            id: slipwayId,
                                            name: details.Name || 'Unknown',
                                            description: details.Description || 'No description available',
                                            latitude: parseFloat(coords[0]),
                                            longitude: parseFloat(coords[1]),
                                            facilities: details.Facilities ? details.Facilities.split(', ').filter((f: string) => f.trim()) : [],
                                            imgs: details.imgs || details.ImageIds || [],
                                            createdBy: details.createdBy,
                                            createdAt: details.createdAt,
                                            updatedBy: details.updatedBy,
                                            updatedAt: details.updatedAt,
                                            charges: details.Charges || 'Unknown',
                                            nearestPlace: details.NearestPlace || 'Unknown',
                                            rampType: details.RampType || 'Unknown',
                                            suitability: details.Suitability || 'Unknown',
                                            directions: details.Directions || '',
                                            email: details.Email || '',
                                            lowerArea: details.LowerArea || '',
                                            mobilePhoneNumber: details.MobilePhoneNumber || '',
                                            navigationalHazards: details.NavigationalHazards || '',
                                            rampDescription: details.RampDescription || '',
                                            rampLength: details.RampLength || '',
                                            upperArea: details.UpperArea || '',
                                            website: details.Website || ''
                                        };
                                        slipwayData.push(slipway);
                                    }
                                }

                                processedCount = endIndex;

                                if (processedCount < slipwayIds.length) {
                                    // Schedule next batch
                                    if ('requestIdleCallback' in window) {
                                        requestIdleCallback(processBatch);
                                    } else {
                                        setTimeout(processBatch, 0);
                                    }
                                } else {
                                    resolve(slipwayData);
                                }
                            };

                            processBatch();
                        });
                    };

                    const processStartTime = performance.now();
                    const slipwayData = await processData();
                    const processTime = performance.now() - processStartTime;
                    console.log(`Data processing completed in ${processTime.toFixed(2)}ms`);

                    setSlipways(slipwayData);
                    setFilteredSlipways(slipwayData);
                    setError(null);
                    console.log(`Successfully loaded ${slipwayData.length} slipways from Firebase`);
                } else {
                    throw new Error('No slipway data found in database');
                }
            } catch (err) {
                console.error('Error fetching slipways:', err);
                setError('Failed to load slipway data');
                // Fallback to hardcoded data if Firebase fails
                setSlipways([
                    {
                        id: '1',
                        name: 'Sample Slipway 1',
                        description: 'A beautiful slipway with great facilities',
                        latitude: 51.505,
                        longitude: -0.09
                    },
                    {
                        id: '2',
                        name: 'Sample Slipway 2',
                        description: 'Another great slipway with stunning views',
                        latitude: 51.515,
                        longitude: -0.1
                    },
                    {
                        id: '3',
                        name: 'Sample Slipway 3',
                        description: 'Perfect for launching boats',
                        latitude: 51.525,
                        longitude: -0.11
                    }
                ]);
            } finally {
                setDataLoading(false);
            }
        };

        fetchSlipways();
    }, []);

    // Filter slipways based on selected filters
    useEffect(() => {
        let filtered = allSlipways;

        if (rampLengthFilter) {
            filtered = filtered.filter((slipway: Slipway) =>
                slipway.rampLength && slipway.rampLength === rampLengthFilter
            );
        }

        if (suitabilityFilter) {
            filtered = filtered.filter((slipway: Slipway) => {
                if (!slipway.suitability) return false;

                // Hierarchical filtering logic
                if (suitabilityFilter === "Portable Only") {
                    // Portable Only includes all suitability types
                    return true;
                } else if (suitabilityFilter === "Small trailer can be pushed") {
                    // Small trailer includes itself and Large trailer
                    return slipway.suitability === "Small trailer can be pushed" ||
                        slipway.suitability === "Large trailer needs a car";
                } else if (suitabilityFilter === "Large trailer needs a car") {
                    // Large trailer only includes itself
                    return slipway.suitability === "Large trailer needs a car";
                }

                return false;
            });
        }

        if (chargesFilter.length > 0) {
            filtered = filtered.filter((slipway: Slipway) => chargesFilter.includes(chargeCategory(slipway.charges)));
        }

        if (photosOnly) {
            filtered = filtered.filter((slipway: Slipway) => (slipway.imgs?.length || 0) > 0);
        }

        setFilteredSlipways(filtered);
    }, [allSlipways, rampLengthFilter, suitabilityFilter, chargesFilter, photosOnly]);

    // Clear filters
    const clearFilters = () => {
        setRampLengthFilter('');
        setSuitabilityFilter('');
        setChargesFilter([]);
        setPhotosOnly(false);
    };

    // Handle center complete
    const handleCenterComplete = () => {
        // This will be handled by App.tsx state management
    };

    // Map instance, marker lookup, search and geolocation state
    const mapRef = useRef<any>(null);
    const markerRefs = useRef<Record<string, any>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [locating, setLocating] = useState(false);
    const [locateError, setLocateError] = useState<string | null>(null);

    const handleMapReady = useMemo(() => (map: any) => { mapRef.current = map; }, []);

    const searchResults = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return [];
        return allSlipways
            .filter(s => s.name.toLowerCase().includes(q) || (s.nearestPlace || '').toLowerCase().includes(q))
            .slice(0, 8);
    }, [searchQuery, allSlipways]);

    const activeFilterCount = [rampLengthFilter, suitabilityFilter, chargesFilter.length > 0, photosOnly].filter(Boolean).length;

    const goToSlipway = (slipway: Slipway) => {
        setSearchOpen(false);
        setShowFilters(false);
        setSearchQuery(slipway.name);
        // Make sure the result is visible even if it is filtered out
        if (!filteredSlipways.some(s => s.id === slipway.id)) clearFilters();
        const map = mapRef.current;
        if (!map) return;
        map.flyTo([slipway.latitude, slipway.longitude], 14, { duration: 0.8 });
        map.once('moveend', () => markerRefs.current[slipway.id]?.openPopup());
    };

    const locateUser = () => {
        if (!navigator.geolocation) {
            setLocateError('Location is not supported on this device');
            return;
        }
        setLocating(true);
        setLocateError(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                setUserLocation(coords);
                mapRef.current?.flyTo(coords, 11, { duration: 0.8 });
                setLocating(false);
            },
            () => {
                setLocateError('Could not get your location. Check your location permissions.');
                setLocating(false);
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
    };

    const handleAddClick = () => {
        if (!user) {
            onNavigate && onNavigate('signin');
            return;
        }
        setShowFilters(false);
        setSearchOpen(false);
        setAddSlipwayMode(!addSlipwayMode);
    };

    useEffect(() => {
        if (!locateError) return;
        const t = setTimeout(() => setLocateError(null), 5000);
        return () => clearTimeout(t);
    }, [locateError]);

    // Shared by Boatlaunch slipways and unverified OSM imports
    const renderMarker = (slipway: Slipway) => {
                const photoCount = slipway.imgs?.length || 0;

                return (
                    <Marker
                        key={slipway.id}
                        position={[slipway.latitude, slipway.longitude] as LatLngExpression}
                        ref={(m: any) => { if (m) markerRefs.current[slipway.id] = m; }}
                        {...{ icon: slipway.source === 'OSM' ? iconOsm : photoCount > 0 ? iconWithPhotos : iconDefault }}
                    >
                        <Popup {...({ autoPanPaddingTopLeft: [16, 96], autoPanPaddingBottomRight: [16, 90] } as any)}>
                            <div className="sw-popup">
                                <div className="sw-popup__body">
                                    <h3 className="sw-popup__title">{truncateText(slipway.name, 100)}</h3>
                                    {hasValue(slipway.nearestPlace) && (
                                        <div className="sw-popup__place"><PinIcon size="sm" />{truncateText(slipway.nearestPlace!, 60)}</div>
                                    )}
                                    <div className="tag-list">
                                        {slipway.source === 'OSM' && <span className="tag tag--osm">OSM</span>}
                                        {hasValue(slipway.suitability) && <span className="tag tag--primary">{slipway.suitability}</span>}
                                        {hasValue(slipway.rampLength) && <span className="tag">{slipway.rampLength}</span>}
                                        {hasValue(slipway.charges) && <span className="tag">{truncateText(slipway.charges!, 30)}</span>}
                                        {photoCount > 0 && <span className="tag tag--success"><CameraIcon size="sm" />{photoCount}</span>}
                                    </div>
                                    {slipway.description && slipway.description !== 'No description available' && (
                                        <p className="sw-popup__desc">{slipway.description}</p>
                                    )}
                                    {hasValue(slipway.navigationalHazards) && (
                                        <div className="sw-popup__hazard">
                                            <AlertIcon size="sm" />
                                            <span>{truncateText(slipway.navigationalHazards!, 120)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="sw-popup__footer">
                                    <a className="btn btn--secondary btn--sm" href={googleMapsUrl(slipway)} target="_blank" rel="noopener noreferrer">
                                        <MapIcon size="sm" /> Google Maps
                                    </a>
                                    <a className="btn btn--secondary btn--sm" href={streetViewUrl(slipway)} target="_blank" rel="noopener noreferrer">
                                        <StreetViewIcon size="sm" /> Street View
                                    </a>
                                    <button className="btn btn--primary btn--sm" onClick={() => setSelectedSlipway(slipway)}>
                                        Details <ChevronRightIcon size="sm" />
                                    </button>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                );
    };

    // Default map center (UK) - will be updated when data loads
    const defaultCenter: [number, number] = [54.2361, -4.5481];
    const mapCenter = filteredSlipways.length > 0
        ? [filteredSlipways[0].latitude, filteredSlipways[0].longitude] as [number, number]
        : defaultCenter;

    return (
        <div className={`map-shell ${addSlipwayMode ? 'is-adding' : ''}`}>
            {/* Search + filters */}
            <div className="map-overlay map-toolbar">
                <div className="map-search-group">
                    <div className="search-box">
                        <SearchIcon />
                        <input
                            type="search"
                            placeholder="Search slipways or places"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); setShowFilters(false); }}
                            onFocus={() => setSearchOpen(true)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') setSearchOpen(false);
                                if (e.key === 'Enter' && searchResults[0]) goToSlipway(searchResults[0]);
                            }}
                            aria-label="Search slipways"
                        />
                        {searchQuery && (
                            <button className="btn btn--ghost btn--icon btn--sm" onClick={() => { setSearchQuery(''); setSearchOpen(false); }} aria-label="Clear search">
                                <XIcon size="sm" />
                            </button>
                        )}
                        <span className="divider" />
                        <button
                            className={`btn btn--ghost btn--icon filter-trigger ${showFilters ? 'is-active' : ''}`}
                            onClick={() => { setShowFilters(!showFilters); setSearchOpen(false); }}
                            aria-label="Filters"
                            aria-expanded={showFilters}
                        >
                            <FilterIcon />
                            {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
                        </button>
                    </div>

                    {searchOpen && searchQuery.trim() && (
                        <div className="search-results">
                            {searchResults.length === 0 ? (
                                <div className="search-empty">No slipways match “{searchQuery}”</div>
                            ) : searchResults.map(s => (
                                <button key={s.id} className="search-result" onClick={() => goToSlipway(s)}>
                                    <strong>{s.name}</strong>
                                    {hasValue(s.nearestPlace) && <small>{s.nearestPlace}</small>}
                                </button>
                            ))}
                        </div>
                    )}

                    {showFilters && (
                        <div className="filter-panel">
                            <div className="filter-panel-head">
                                <h3>Filter slipways</h3>
                                <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setShowFilters(false)} aria-label="Close filters">
                                    <XIcon size="sm" />
                                </button>
                            </div>
                            <label className="field">
                                <span className="field-label">Ramp length</span>
                                <select className="select" value={rampLengthFilter} onChange={(e) => setRampLengthFilter(e.target.value)}>
                                    <option value="">Any ramp length</option>
                                    <option value="All of tidal range">All of tidal range</option>
                                    <option value="3/4 tidal">3/4 tidal</option>
                                    <option value="1/2 tidal">1/2 tidal</option>
                                    <option value="1/4 tidal">1/4 tidal</option>
                                    <option value="Non-tidal">Non-tidal</option>
                                </select>
                            </label>
                            <label className="field">
                                <span className="field-label">What are you launching?</span>
                                <select className="select" value={suitabilityFilter} onChange={(e) => setSuitabilityFilter(e.target.value)}>
                                    <option value="">Anything</option>
                                    <option value="Large trailer needs a car">Large trailer (needs a car)</option>
                                    <option value="Small trailer can be pushed">Small trailer (can be pushed)</option>
                                    <option value="Portable Only">Portable craft only</option>
                                </select>
                            </label>
                            <div className="field" role="group" aria-labelledby="charges-label">
                                <span className="field-label" id="charges-label">Charges <span className="field-hint">(choose any)</span></span>
                                <div className="chip-group">
                                    {CHARGE_OPTIONS.map(opt => {
                                        const selected = chargesFilter.includes(opt.value);
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                className={`chip ${selected ? 'is-selected' : ''}`}
                                                aria-pressed={selected}
                                                onClick={() => setChargesFilter(prev =>
                                                    selected ? prev.filter(v => v !== opt.value) : [...prev, opt.value]
                                                )}
                                            >
                                                {selected && <CheckIcon size="sm" />}{opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <label className="toggle">
                                <input type="checkbox" checked={photosOnly} onChange={(e) => setPhotosOnly(e.target.checked)} />
                                <span className="toggle-track" aria-hidden="true" />
                                <span className="toggle-label"><CameraIcon size="sm" /> Only slipways with photos</span>
                            </label>
                            {!osmUnavailable && <label className="toggle">
                                <input type="checkbox" checked={showOsm} onChange={(e) => setShowOsm(e.target.checked)} />
                                <span className="toggle-track" aria-hidden="true" />
                                <span className="toggle-label">
                                    <LayersIcon size="sm" /> Include unverified OpenStreetMap slipways
                                    {osmLoading && <span className="spinner" />}
                                </span>
                            </label>}
                            <div className="filter-panel-foot">
                                <span><strong>{filteredSlipways.length.toLocaleString()}</strong> of {allSlipways.length.toLocaleString()} slipways</span>
                                <button className="btn btn--secondary btn--sm" onClick={clearFilters} disabled={activeFilterCount === 0}>
                                    <XIcon size="sm" /> Clear all filters
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Status banners */}
            {dataLoading && (
                <div className="map-overlay map-banner">
                    <span className="spinner" /> Loading slipways…
                </div>
            )}
            {!dataLoading && addSlipwayMode && (
                <div className="map-overlay map-banner">
                    <PinIcon /> Tap the map where the slipway is
                    <button className="btn" onClick={() => setAddSlipwayMode(false)}>Cancel</button>
                </div>
            )}
            {!dataLoading && !addSlipwayMode && (error || locateError || osmError || showSuccessMessage) && (
                <div className={`map-overlay map-banner ${showSuccessMessage ? '' : 'map-banner--error'}`} role="status">
                    <AlertIcon /> {showSuccessMessage || locateError || osmError || `${error}. Showing sample data.`}
                    {osmError && <button className="btn" onClick={() => setOsmError(null)}>Dismiss</button>}
                    {locateError && <button className="btn" onClick={() => setLocateError(null)}>Dismiss</button>}
                </div>
            )}

            {/* Bottom-left: count + legend */}
            {!dataLoading && (
                <div className="map-overlay map-footer">
                    <div className="map-pill">
                        <span><strong>{filteredSlipways.length.toLocaleString()}</strong> slipways{activeFilterCount > 0 && <span className="hide-mobile"> (filtered)</span>}</span>
                        {activeFilterCount > 0 && (
                            <button className="pill-clear" onClick={clearFilters} aria-label="Clear all filters">
                                <XIcon size="sm" /> Clear<span className="hide-mobile"> filters</span>
                            </button>
                        )}
                        <span className="legend"><span className="legend-dot legend-dot--photos" />Has photos</span>
                        <span className="legend"><span className="legend-dot legend-dot--plain" />No photos</span>
                        {osmVisible && osmSlipways && (
                            <span className="legend"><span className="legend-dot legend-dot--osm" />Unverified (OSM)</span>
                        )}
                    </div>
                </div>
            )}

            {/* Bottom-right: locate + add */}
            <div className="map-overlay map-fabs">
                <button
                    className="btn btn--secondary btn--icon fab-round"
                    onClick={locateUser}
                    disabled={locating}
                    aria-label="Show slipways near me"
                    title="Near me"
                >
                    {locating ? <span className="spinner" /> : <LocateIcon />}
                </button>
                <button
                    className={`btn btn--lg fab ${addSlipwayMode ? 'btn--danger' : 'btn--primary'}`}
                    onClick={handleAddClick}
                >
                    {addSlipwayMode ? <><XIcon /> Cancel</> : <><PlusIcon /> Add slipway</>}
                </button>
            </div>

            <MapContainer
                {...({
                    center: mapCenter,
                    zoom: 6,
                    zoomControl: false,
                    style: { height: '100%', width: '100%' }
                } as any)}
            >
                <TileLayer
                    {...({
                        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    } as any)}
                />
                <ZoomControl position="topright" />
                <MapBridge onReady={handleMapReady} />
                <MapClickHandler onMapClick={(lat, lng) => { setSearchOpen(false); setShowFilters(false); handleMapClick(lat, lng); }} />
                <MapUpdater centerOnSlipway={centerOnSlipway} onCenterComplete={handleCenterComplete} />
                {userLocation && (
                    <CircleMarker
                        {...({
                            center: userLocation,
                            radius: 8,
                            pathOptions: { color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }
                        } as any)}
                    />
                )}
                {filteredSlipways.map(renderMarker)}
            </MapContainer>

            {/* Slipway Details Modal */}
            {selectedSlipway && (
                <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setSelectedSlipway(null); }}>
                    <div className="modal" role="dialog" aria-modal="true" aria-label={selectedSlipway.name}>
                        <SlipwayView
                            slipwayId={selectedSlipway.id}
                            slipwayData={selectedSlipway}
                            variant="modal"
                            onSaved={(saved, promotedFromOsmId) => {
                                // Keep the map's copy current so popups and reopening the modal show the saved details
                                setSlipways(prev => prev.some(s => s.id === saved.id)
                                    ? prev.map(s => (s.id === saved.id ? saved : s))
                                    : [...prev, saved]);
                                if (promotedFromOsmId) {
                                    // Swap the amber OSM pin for a Boatlaunch one and keep the modal on the new slipway
                                    setOsmSlipways(prev => prev && prev.filter(o => o.id !== promotedFromOsmId));
                                    setSelectedSlipway(saved);
                                }
                            }}
                            onNavigate={(view: string, data?: any) => {
                                if (view === 'map') {
                                    setSelectedSlipway(null);
                                } else {
                                    // Pass through other navigation requests to parent
                                    onNavigate && onNavigate(view, data);
                                }
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Map;
