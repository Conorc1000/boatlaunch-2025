import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import { ref, set, push } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../hooks/useAuth';
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
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = iconDefault;

interface AddSlipwayProps {
    initialLocation?: { latitude: number; longitude: number } | null;
    onNavigate?: (view: string, data?: any) => void;
}

const AddSlipway: React.FC<AddSlipwayProps> = ({ initialLocation, onNavigate }) => {
    const { user } = useAuth();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Store initial location to prevent it from being lost
    const [storedLocation] = useState(initialLocation);
    console.log('AddSlipway component initialized with:', { initialLocation, storedLocation });
    
    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        facilities: '',
        charges: '',
        nearestPlace: '',
        rampType: '',
        suitability: '',
        rampLength: '',
        upperArea: '',
        lowerArea: '',
        directions: '',
        email: '',
        mobilePhoneNumber: '',
        website: '',
        navigationalHazards: '',
        rampDescription: ''
    });

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!user) {
            setError('You must be logged in to add a slipway');
            return;
        }

        if (!initialLocation) {
            setError('Location is required');
            return;
        }

        if (!formData.name.trim()) {
            setError('Slipway name is required');
            return;
        }

        try {
            setSaving(true);
            setError(null);

            // Generate a new slipway ID
            const newSlipwayRef = push(ref(database, 'latLngs'));
            const slipwayId = newSlipwayRef.key;

            if (!slipwayId) {
                throw new Error('Failed to generate slipway ID');
            }

            // Save coordinates
            await set(ref(database, `latLngs/${slipwayId}`), [
                initialLocation.latitude.toString(),
                initialLocation.longitude.toString()
            ]);

            // Save slipway details
            const slipwayDetails = {
                Name: formData.name.trim(),
                Description: formData.description.trim() || 'No description provided',
                RampDescription: formData.rampDescription.trim() || formData.description.trim(),
                Facilities: formData.facilities.trim(),
                Charges: formData.charges.trim(),
                NearestPlace: formData.nearestPlace.trim(),
                RampType: formData.rampType,
                Suitability: formData.suitability,
                RampLength: formData.rampLength,
                UpperArea: formData.upperArea,
                LowerArea: formData.lowerArea,
                Directions: formData.directions.trim(),
                Email: formData.email.trim(),
                MobilePhoneNumber: formData.mobilePhoneNumber.trim(),
                Website: formData.website.trim(),
                NavigationalHazards: formData.navigationalHazards.trim(),
                imgs: [], // Start with no images
                comments: [] // Start with no comments
            };

            await set(ref(database, `slipwayDetails/${slipwayId}`), slipwayDetails);

            // Navigate back to map with the new slipway data
            if (onNavigate) {
                onNavigate('map', {
                    centerOnSlipway: {
                        id: slipwayId,
                        latitude: initialLocation.latitude,
                        longitude: initialLocation.longitude,
                        name: formData.name.trim()
                    }
                });
            }
        } catch (err) {
            console.error('Error saving slipway:', err);
            setError('Failed to save slipway. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (!user) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <h2>Authentication Required</h2>
                <p>You must be logged in to add a new slipway.</p>
                <button
                    onClick={() => onNavigate && onNavigate('map')}
                    style={{
                        backgroundColor: '#3498db',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '16px'
                    }}
                >
                    Back to Map
                </button>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '30px', borderBottom: '2px solid #eee', paddingBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h1 style={{ margin: 0, color: '#2c3e50' }}>Add New Slipway</h1>
                    <button
                        onClick={() => onNavigate && onNavigate('map')}
                        style={{
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        ← Back to Map
                    </button>
                </div>
                {initialLocation && (
                    <p style={{ margin: '10px 0', fontSize: '16px', color: '#666' }}>
                        Location: {initialLocation.latitude.toFixed(6)}, {initialLocation.longitude.toFixed(6)}
                    </p>
                )}
            </div>

            {/* Error Display */}
            {error && (
                <div style={{
                    backgroundColor: '#f8d7da',
                    color: '#721c24',
                    padding: '12px',
                    borderRadius: '4px',
                    marginBottom: '20px',
                    border: '1px solid #f5c6cb'
                }}>
                    {error}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                {/* Form */}
                <div>
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                Slipway Name *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px'
                                }}
                                placeholder="Enter slipway name"
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => handleInputChange('description', e.target.value)}
                                style={{
                                    width: '100%',
                                    minHeight: '80px',
                                    padding: '8px 12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    fontFamily: 'inherit',
                                    resize: 'vertical'
                                }}
                                placeholder="Describe the slipway"
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                    Ramp Type
                                </label>
                                <input
                                    type="text"
                                    value={formData.rampType}
                                    onChange={(e) => handleInputChange('rampType', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                    placeholder="e.g., Concrete, Shingle, Sand"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                    Suitability
                                </label>
                                <select
                                    value={formData.suitability}
                                    onChange={(e) => handleInputChange('suitability', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                >
                                    <option value="">Select suitability...</option>
                                    <option value="Large trailer needs a car">Large trailer needs a car</option>
                                    <option value="Small trailer can be pushed">Small trailer can be pushed</option>
                                    <option value="Portable Only">Portable Only</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                    Ramp Length
                                </label>
                                <select
                                    value={formData.rampLength}
                                    onChange={(e) => handleInputChange('rampLength', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                >
                                    <option value="">Select ramp length...</option>
                                    <option value="All of tidal range">All of tidal range</option>
                                    <option value="3/4 tidal">3/4 tidal</option>
                                    <option value="1/2 tidal">1/2 tidal</option>
                                    <option value="1/4 tidal">1/4 tidal</option>
                                    <option value="Non-tidal">Non-tidal</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                    Charges
                                </label>
                                <input
                                    type="text"
                                    value={formData.charges}
                                    onChange={(e) => handleInputChange('charges', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                    placeholder="e.g., Free, £5 per launch"
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                Facilities
                            </label>
                            <textarea
                                value={formData.facilities}
                                onChange={(e) => handleInputChange('facilities', e.target.value)}
                                style={{
                                    width: '100%',
                                    minHeight: '60px',
                                    padding: '8px 12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    fontFamily: 'inherit',
                                    resize: 'vertical'
                                }}
                                placeholder="List facilities separated by commas (e.g., Parking, Toilets, Café)"
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                    Nearest Place
                                </label>
                                <input
                                    type="text"
                                    value={formData.nearestPlace}
                                    onChange={(e) => handleInputChange('nearestPlace', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                    placeholder="Nearest town or landmark"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleInputChange('email', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                    placeholder="Contact email"
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                    Mobile Phone
                                </label>
                                <input
                                    type="tel"
                                    value={formData.mobilePhoneNumber}
                                    onChange={(e) => handleInputChange('mobilePhoneNumber', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                    placeholder="Contact phone number"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                    Website
                                </label>
                                <input
                                    type="url"
                                    value={formData.website}
                                    onChange={(e) => handleInputChange('website', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                    placeholder="Website URL"
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                Directions
                            </label>
                            <textarea
                                value={formData.directions}
                                onChange={(e) => handleInputChange('directions', e.target.value)}
                                style={{
                                    width: '100%',
                                    minHeight: '60px',
                                    padding: '8px 12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    fontFamily: 'inherit',
                                    resize: 'vertical'
                                }}
                                placeholder="Directions to the slipway"
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                Navigational Hazards
                            </label>
                            <textarea
                                value={formData.navigationalHazards}
                                onChange={(e) => handleInputChange('navigationalHazards', e.target.value)}
                                style={{
                                    width: '100%',
                                    minHeight: '60px',
                                    padding: '8px 12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    fontFamily: 'inherit',
                                    resize: 'vertical'
                                }}
                                placeholder="Any navigational hazards to be aware of"
                            />
                        </div>

                        <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                            <button
                                type="submit"
                                disabled={saving || !formData.name.trim()}
                                style={{
                                    backgroundColor: saving || !formData.name.trim() ? '#6c757d' : '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    padding: '12px 24px',
                                    borderRadius: '4px',
                                    cursor: saving || !formData.name.trim() ? 'not-allowed' : 'pointer',
                                    fontSize: '16px',
                                    fontWeight: '500',
                                    marginRight: '10px'
                                }}
                            >
                                {saving ? 'Saving...' : 'Save Slipway'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    console.log('Back to Map clicked, storedLocation:', storedLocation);
                                    if (onNavigate && storedLocation) {
                                        console.log('Navigating with centerOnSlipway data');
                                        onNavigate('map', {
                                            centerOnSlipway: {
                                                id: 'preview',
                                                latitude: storedLocation.latitude,
                                                longitude: storedLocation.longitude,
                                                name: 'Selected Location'
                                            }
                                        });
                                    } else if (onNavigate) {
                                        console.log('Navigating without data - storedLocation is null/undefined');
                                        onNavigate('map');
                                    }
                                }}
                                disabled={saving}
                                style={{
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    padding: '12px 24px',
                                    borderRadius: '4px',
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    fontSize: '16px'
                                }}
                            >
                                Back to Map
                            </button>
                        </div>
                    </form>
                </div>

                {/* Map */}
                <div>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#2c3e50' }}>Location Preview</h3>
                    {storedLocation ? (
                        <div style={{ height: '500px', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
                            <MapContainer
                                {...({
                                    center: [storedLocation.latitude, storedLocation.longitude] as LatLngExpression,
                                    zoom: 15,
                                    style: { height: '100%', width: '100%' }
                                } as any)}
                            >
                                <TileLayer
                                    {...({
                                        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    } as any)}
                                />
                                <Marker position={[storedLocation.latitude, storedLocation.longitude] as LatLngExpression}>
                                    <Popup>
                                        <div>
                                            <strong>New Slipway Location</strong>
                                            <br />
                                            {storedLocation.latitude.toFixed(6)}, {storedLocation.longitude.toFixed(6)}
                                        </div>
                                    </Popup>
                                </Marker>
                            </MapContainer>
                        </div>
                    ) : (
                        <div style={{
                            height: '500px',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f8f9fa',
                            color: '#6c757d'
                        }}>
                            No location selected. Click on the map to choose a location.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddSlipway;
