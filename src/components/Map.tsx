import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { ref, get, update } from 'firebase/database';
import { database } from '../firebase.ts';
import { Slipway } from '../types/Slipway.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { fetchImgsService, generateImageId, validateImageFile } from '../services/fetchImgService.ts';
import { imgUploadService } from '../services/imgUploadService.ts';
import SlipwayView from './SlipwayView.tsx';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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

L.Marker.prototype.options.icon = iconDefault;

interface MapProps {
    onNavigate?: (view: string, slipwayId?: string) => void;
}

const Map: React.FC<MapProps> = ({ onNavigate }) => {
    const [slipways, setSlipways] = useState<Slipway[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSlipway, setSelectedSlipway] = useState<Slipway | null>(null);
    
    const [slipwayImages, setSlipwayImages] = useState<{[key: string]: string[]}>({});

    const { user } = useAuth();

    // Helper function to truncate long text
    const truncateText = (text: string, maxLength: number = 200): string => {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
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
                                description: details.RampDescription || details.Description || 'No description available',
                                latitude: parseFloat(coords[0]),
                                longitude: parseFloat(coords[1]),
                                facilities: details.Facilities ? details.Facilities.split(', ').filter((f: string) => f.trim()) : [],
                                charges: details.Charges || 'Unknown',
                                nearestPlace: details.NearestPlace || 'Unknown',
                                rampType: details.RampType || 'Unknown',
                                suitability: details.Suitability || 'Unknown'
                            };

                            // Store image IDs if they exist
                            if (details.ImageIds && Array.isArray(details.ImageIds)) {
                                setSlipwayImages(prev => ({
                                    ...prev,
                                    [slipwayId]: details.ImageIds
                                }));
                            }

                            slipwayData.push(slipway);
                        }
                    });

                    setSlipways(slipwayData);
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
        <>
            <div style={{ width: '100%', height: '80vh', borderRadius: '10px', overflow: 'hidden' }}>
                {error && (
                    <div style={{
                        padding: '10px',
                        backgroundColor: '#fff3cd',
                        color: '#856404',
                        borderRadius: '5px',
                        marginBottom: '10px'
                    }}>
                        {error} - Using sample data
                    </div>
                )}
                <MapContainer
                    center={slipways.length > 0 ? [slipways[0].latitude, slipways[0].longitude] : [51.505, -0.09]}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    {slipways.map((slipway) => {
                        const imageIds = slipwayImages[slipway.id] || [];
                        const photoCount = imageIds.length;
                        
                        return (
                            <Marker
                                key={slipway.id}
                                position={[slipway.latitude, slipway.longitude]}
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
                    zIndex: 10000
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
                                zIndex: 10001,
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

        </>
    );
};

export default Map;
