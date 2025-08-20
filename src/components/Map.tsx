import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import { ref, get } from 'firebase/database';
import { database } from '../firebase';
import { Slipway } from '../types/Slipway';
import { useAuth } from '../hooks/useAuth';
import SlipwayView from './SlipwayView';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issue
const iconRetinaUrl = require('leaflet/dist/images/marker-icon-2x.png');
const iconUrl = require('leaflet/dist/images/marker-icon.png');
const shadowUrl = require('leaflet/dist/images/marker-shadow.png');

const iconDefault = L.icon({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});

// Create a green icon for slipways with photos
const iconWithPhotos = L.icon({
    iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41">
            <path fill="#28a745" stroke="#1e7e34" stroke-width="1" d="M12.5,0C5.6,0,0,5.6,0,12.5c0,12.5,12.5,28.5,12.5,28.5s12.5-16,12.5-28.5C25,5.6,19.4,0,12.5,0z"/>
            <circle fill="white" cx="12.5" cy="12.5" r="6"/>
            <rect fill="#28a745" x="8" y="9" width="9" height="7" rx="1"/>
            <circle fill="white" cx="12.5" cy="12.5" r="1.5"/>
            <rect fill="#28a745" x="9" y="8" width="2" height="1" rx="0.5"/>
        </svg>
    `),
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl,
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = iconDefault;

interface MapProps {
    onNavigate?: (view: string, data?: any) => void;
    centerOnSlipway?: { id: string; latitude: number; longitude: number; name: string } | null;
}

// Component to handle map clicks for adding new slipways
const MapClickHandler: React.FC<{ onMapClick: (lat: number, lng: number) => void }> = ({ onMapClick }) => {
    useMapEvents({
        click: (e) => {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
};

// Component to handle map updates and centering
const MapUpdater: React.FC<{ centerOnSlipway: any; onCenterComplete: () => void }> = ({ centerOnSlipway, onCenterComplete }) => {
    const mapRef = useRef(null);
    
    useEffect(() => {
        if (centerOnSlipway) {
            const map = mapRef.current;
            if (map) {
                map.setView([centerOnSlipway.latitude, centerOnSlipway.longitude], 15);
            }
            });
            
            // Clear after animation
            const timer = setTimeout(() => {
                console.log('MapUpdater calling onCenterComplete');
                onCenterComplete();
            }, 1500);
            
            return () => clearTimeout(timer);
        }
    }, [centerOnSlipway?.timestamp, centerOnSlipway?.latitude, centerOnSlipway?.longitude, map, onCenterComplete]);
    
    return null;
};

const Map: React.FC<MapProps> = ({ onNavigate, centerOnSlipway }) => {
    const [slipways, setSlipways] = useState<Slipway[]>([]);
    const [filteredSlipways, setFilteredSlipways] = useState<Slipway[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSlipway, setSelectedSlipway] = useState<Slipway | null>(null);
    const [rampLengthFilter, setRampLengthFilter] = useState<string>('');
    const [suitabilityFilter, setSuitabilityFilter] = useState<string>('');
    const [showFilters, setShowFilters] = useState<boolean>(false);
    const [addSlipwayMode, setAddSlipwayMode] = useState<boolean>(false);
    const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);

    const { user } = useAuth();

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

    // Handle success message for saved slipways
    useEffect(() => {
        console.log('Map component received centerOnSlipway:', centerOnSlipway);
        if (centerOnSlipway && centerOnSlipway.id !== 'preview') {
            setShowSuccessMessage(`Successfully added "${centerOnSlipway.name}"!`);
            // Auto-hide success message after 5 seconds
            setTimeout(() => {
                setShowSuccessMessage(null);
            }, 5000);
        }
    }, [centerOnSlipway]);

    // Clear centering state after animation complete
    const handleCenterComplete = () => {
        // This will be handled by App.tsx state management
    };

    useEffect(() => {
        const fetchSlipways = async () => {
            try {
                setLoading(true);

                // Fetch both latLngs and slipwayDetails
                const latLngsRef = ref(database, 'latLngs');
                const slipwayDetailsRef = ref(database, 'slipwayDetails');

                const [latLngsSnapshot, detailsSnapshot] = await Promise.all([
                    get(latLngsRef),
                    get(slipwayDetailsRef)
                ]);

                if (latLngsSnapshot.exists() && detailsSnapshot.exists()) {
                    const latLngsData = latLngsSnapshot.val();
                    const detailsData = detailsSnapshot.val();
                    const slipwayData: Slipway[] = [];

                    // Combine latLngs and details data
                    Object.keys(latLngsData).forEach((slipwayId) => {
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
                                comments: details.comments || [],
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
                    });

                    setSlipways(slipwayData);
                    setFilteredSlipways(slipwayData);
                    setError(null);
                    console.log(`Loaded ${slipwayData.length} slipways from Firebase`);
                } else {
                    // No data found, use fallback
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
                setLoading(false);
            }
        };

        fetchSlipways();
    }, []);

    // Filter slipways based on selected filters
    useEffect(() => {
        let filtered = slipways;

        if (rampLengthFilter) {
            filtered = filtered.filter(slipway => 
                slipway.rampLength && slipway.rampLength === rampLengthFilter
            );
        }

        if (suitabilityFilter) {
            filtered = filtered.filter(slipway => {
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

        setFilteredSlipways(filtered);
    }, [slipways, rampLengthFilter, suitabilityFilter]);

    const clearFilters = () => {
        setRampLengthFilter('');
        setSuitabilityFilter('');
    };




    if (loading) {
        return (
            <div style={{
                width: '100%',
                height: '80vh',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f0f0f0'
            }}>
                <p>Loading slipway locations...</p>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '80vh', borderRadius: '10px', overflow: 'hidden' }}>
            {/* Top buttons */}
            <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1001, display: 'flex', gap: '10px' }}>
                {/* Add Slipway Button */}
                {user && (
                    <button
                        onClick={() => setAddSlipwayMode(!addSlipwayMode)}
                        style={{
                            backgroundColor: addSlipwayMode ? '#e74c3c' : '#27ae60',
                            color: 'white',
                            border: 'none',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = addSlipwayMode ? '#c0392b' : '#219a52'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = addSlipwayMode ? '#e74c3c' : '#27ae60'}
                    >
                        {addSlipwayMode ? '✕ Cancel' : '➕ Add Slipway'}
                    </button>
                )}
                
                {/* Filter Toggle Button */}
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    style={{
                        backgroundColor: '#3498db',
                        color: 'white',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2980b9'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3498db'}
                >
                    {showFilters ? '🔍 Hide Filters' : '🔍 Show Filters'}
                </button>
            </div>

            {/* Add Slipway Mode Indicator */}
            {addSlipwayMode && (
                <div style={{
                    position: 'absolute',
                    top: '60px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1001,
                    backgroundColor: '#27ae60',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                }}>
                    📍 Click on the map to add a new slipway
                </div>
            )}

            {/* Success Message */}
            {showSuccessMessage && (
                <div style={{
                    position: 'absolute',
                    top: '60px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1001,
                    backgroundColor: '#28a745',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '6px',
                    fontSize: '16px',
                    fontWeight: '500',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    border: '1px solid #1e7e34'
                }}>
                    ✅ {showSuccessMessage}
                </div>
            )}

            {/* Filter Controls */}
            {showFilters && (
                <div style={{
                    position: 'absolute',
                    top: '50px',
                    right: '10px',
                    zIndex: 1000,
                    backgroundColor: 'white',
                    padding: '15px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    border: '1px solid #ddd',
                    minWidth: '300px'
                }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '16px' }}>Filter Slipways</h4>
                
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                            Ramp Length
                        </label>
                        <select
                            value={rampLengthFilter}
                            onChange={(e) => setRampLengthFilter(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '6px 8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px',
                                backgroundColor: 'white'
                            }}
                        >
                            <option value="">All ramp lengths</option>
                            <option value="All of tidal range">All of tidal range</option>
                            <option value="3/4 tidal">3/4 tidal</option>
                            <option value="1/2 tidal">1/2 tidal</option>
                            <option value="1/4 tidal">1/4 tidal</option>
                            <option value="Non-tidal">Non-tidal</option>
                        </select>
                    </div>
                    
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                            Suitability
                        </label>
                        <select
                            value={suitabilityFilter}
                            onChange={(e) => setSuitabilityFilter(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '6px 8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px',
                                backgroundColor: 'white'
                            }}
                        >
                            <option value="">All suitability types</option>
                            <option value="Large trailer needs a car">Large trailer needs a car</option>
                            <option value="Small trailer can be pushed">Small trailer can be pushed</option>
                            <option value="Portable Only">Portable Only</option>
                        </select>
                    </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#666' }}>
                        Showing {filteredSlipways.length} of {slipways.length} slipways
                    </span>
                    
                    {(rampLengthFilter || suitabilityFilter) && (
                        <button
                            onClick={clearFilters}
                            style={{
                                backgroundColor: '#6c757d',
                                color: 'white',
                                border: 'none',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer'
                            }}
                        >
                            Clear Filters
                        </button>
                    )}
                </div>
                </div>
            )}

            <div style={{ width: '100%', height: '100%' }}>
                {error && (
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        backgroundColor: '#f8d7da',
                        color: '#721c24',
                        padding: '10px',
                        borderRadius: '5px',
                        zIndex: 1000,
                        border: '1px solid #f5c6cb',
                        maxWidth: '300px'
                    }}>
                        {error}
                    </div>
                )}
                <MapContainer
                    {...({
                        center: filteredSlipways.length > 0 ? [filteredSlipways[0].latitude, filteredSlipways[0].longitude] : [51.505, -0.09],
                        zoom: 13,
                        style: { height: '100%', width: '100%' }
                    } as any)}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <MapClickHandler onMapClick={handleMapClick} />
                    <MapUpdater centerOnSlipway={centerOnSlipway} onCenterComplete={handleCenterComplete} />
                    {filteredSlipways.map((slipway) => {
                        const photoCount = slipway.imgs?.length || 0

                        return (
                            <Marker
                                key={slipway.id}
                                position={[slipway.latitude, slipway.longitude] as LatLngExpression}
                                {...(photoCount > 0 ? { icon: iconWithPhotos } : {})}
                            >
                                <Popup>
                                    <div style={{ minWidth: '250px' }}>
                                        <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>{truncateText(slipway.name, 100)}</h3>
                                        <p style={{ margin: '0 0 10px 0' }}>{truncateText(slipway.description)}</p>

                                        {/* Photo count display */}
                                        <div style={{ margin: '10px 0', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #e9ecef' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '14px', color: '#495057' }}>
                                                    📸 {photoCount} photo{photoCount !== 1 ? 's' : ''}
                                                </span>
                                                {photoCount > 0 && (
                                                    <button
                                                        onClick={() => setSelectedSlipway(slipway)}
                                                        style={{
                                                            backgroundColor: '#28a745',
                                                            color: 'white',
                                                            border: 'none',
                                                            padding: '4px 8px',
                                                            borderRadius: '3px',
                                                            cursor: 'pointer',
                                                            fontSize: '12px',
                                                            fontWeight: '500'
                                                        }}
                                                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
                                                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
                                                    >
                                                        View Photos
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {slipway.facilities && slipway.facilities.length > 0 && (
                                            <div style={{ marginBottom: '10px' }}>
                                                <strong>Facilities:</strong>
                                                <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                                                    {slipway.facilities.map((facility, index) => (
                                                        <li key={index}>{truncateText(facility, 80)}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {slipway.charges && (
                                            <p style={{ margin: '5px 0' }}><strong>Charges:</strong> {truncateText(slipway.charges, 100)}</p>
                                        )}
                                        {slipway.nearestPlace && (
                                            <p style={{ margin: '5px 0' }}><strong>Nearest Place:</strong> {truncateText(slipway.nearestPlace, 100)}</p>
                                        )}
                                        {slipway.rampType && (
                                            <p style={{ margin: '5px 0' }}><strong>Ramp Type:</strong> {truncateText(slipway.rampType, 100)}</p>
                                        )}
                                        {slipway.suitability && (
                                            <p style={{ margin: '5px 0' }}><strong>Suitability:</strong> {truncateText(slipway.suitability, 150)}</p>
                                        )}
                                        {(slipway as any).upperArea && (
                                            <p style={{ margin: '5px 0' }}><strong>Upper Area:</strong> {truncateText((slipway as any).upperArea, 100)}</p>
                                        )}
                                        {(slipway as any).lowerArea && (
                                            <p style={{ margin: '5px 0' }}><strong>Lower Area:</strong> {truncateText((slipway as any).lowerArea, 100)}</p>
                                        )}
                                        {(slipway as any).rampLength && (
                                            <p style={{ margin: '5px 0' }}><strong>Ramp Length:</strong> {truncateText((slipway as any).rampLength, 100)}</p>
                                        )}
                                        {(slipway as any).website && (
                                            <p style={{ margin: '5px 0' }}><strong>Website:</strong> <a href={(slipway as any).website} target="_blank" rel="noopener noreferrer" style={{ color: '#3498db' }}>{truncateText((slipway as any).website, 50)}</a></p>
                                        )}
                                        {(slipway as any).directions && (
                                            <div style={{ margin: '5px 0' }}>
                                                <strong>Directions:</strong>
                                                <p style={{ margin: '2px 0', fontSize: '13px', color: '#666' }}>{truncateText((slipway as any).directions)}</p>
                                            </div>
                                        )}
                                        {(slipway as any).navigationalHazards && (
                                            <div style={{ margin: '5px 0' }}>
                                                <strong>Navigational Hazards:</strong>
                                                <p style={{ margin: '2px 0', fontSize: '13px', color: '#d32f2f' }}>{truncateText((slipway as any).navigationalHazards)}</p>
                                            </div>
                                        )}

                                        <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                <button
                                                    onClick={() => setSelectedSlipway(slipway)}
                                                    style={{
                                                        backgroundColor: '#28a745',
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '8px 16px',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '14px',
                                                        fontWeight: '500'
                                                    }}
                                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
                                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
                                                >
                                                    👁️ View Details
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
                </MapContainer>
            </div>

            {/* Slipway Details Modal */}
            {selectedSlipway && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '10px',
                        width: '95%',
                        maxWidth: '900px',
                        maxHeight: '90vh',
                        overflow: 'hidden',
                        position: 'relative'
                    }}>
                        {/* Close button */}
                        <button
                            onClick={() => setSelectedSlipway(null)}
                            style={{
                                position: 'absolute',
                                top: '15px',
                                right: '15px',
                                background: 'rgba(0, 0, 0, 0.1)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '32px',
                                height: '32px',
                                cursor: 'pointer',
                                fontSize: '18px',
                                fontWeight: 'bold',
                                color: '#666',
                                zIndex: 10000,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)'}
                        >
                            ×
                        </button>

                        {/* SlipwayView component */}
                        <div style={{ height: '90vh', overflow: 'auto' }}>
                            <SlipwayView
                                slipwayId={selectedSlipway.id}
                                slipwayData={selectedSlipway}
                                onNavigate={(view: string) => {
                                    if (view === 'map') {
                                        setSelectedSlipway(null);
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Map;
