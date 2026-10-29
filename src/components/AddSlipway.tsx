import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import { ref, set, push } from 'firebase/database';
import { database } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { AlertIcon, ArrowLeftIcon, CheckIcon, PinIcon } from './Icons';
import 'leaflet/dist/leaflet.css';

// Pin for the new slipway location (does not override the global default marker icon)
const newSlipwayIcon = L.icon({
    iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40"><path fill="#0e7490" stroke="#fff" stroke-width="1.5" d="M14 1C7 1 1.5 6.5 1.5 13.5 1.5 23 14 38.5 14 38.5S26.5 23 26.5 13.5C26.5 6.5 21 1 14 1Z"/><circle fill="#fff" cx="14" cy="13.5" r="4.5"/></svg>'
    ),
    iconSize: [28, 40],
    iconAnchor: [14, 39],
    popupAnchor: [0, -34]
});

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


    const backToMap = () => {
        if (onNavigate && storedLocation) {
            onNavigate('map', {
                centerOnSlipway: {
                    id: 'preview',
                    latitude: storedLocation.latitude,
                    longitude: storedLocation.longitude,
                    name: 'Selected Location'
                }
            });
        } else if (onNavigate) {
            onNavigate('map');
        }
    };

    if (!user) {
        return (
            <div className="center-state">
                <h2>Sign in to add a slipway</h2>
                <p>You need an account to add new slipways to the map.</p>
                <div className="btn-row">
                    <button onClick={() => onNavigate && onNavigate('map')} className="btn btn--secondary">
                        <ArrowLeftIcon size="sm" /> Back to map
                    </button>
                    <button onClick={() => onNavigate && onNavigate('signin')} className="btn btn--primary">
                        Sign in
                    </button>
                </div>
            </div>
        );
    }

    const text = (field: keyof typeof formData, label: string, placeholder: string, opts: { type?: string; full?: boolean; required?: boolean; hint?: string } = {}) => (
        <label className={`field ${opts.full ? 'field--full' : ''}`}>
            <span className="field-label">{label}{opts.required && <span className="req">*</span>}</span>
            <input
                className="input"
                type={opts.type || 'text'}
                value={formData[field]}
                onChange={(e) => handleInputChange(field, e.target.value)}
                placeholder={placeholder}
                required={opts.required}
            />
            {opts.hint && <span className="field-hint">{opts.hint}</span>}
        </label>
    );

    const area = (field: 'upperArea' | 'lowerArea', label: string) => (
        <label className="field">
            <span className="field-label">{label}</span>
            <select className="select" value={formData[field]} onChange={(e) => handleInputChange(field, e.target.value)}>
                <option value="">Select…</option>
                {['Harbour', 'Shingle', 'Concrete', 'Sand', 'Rock', 'Mud'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        </label>
    );

    const longText = (field: keyof typeof formData, label: string, placeholder: string) => (
        <label className="field field--full">
            <span className="field-label">{label}</span>
            <textarea
                className="textarea"
                value={formData[field]}
                onChange={(e) => handleInputChange(field, e.target.value)}
                placeholder={placeholder}
            />
        </label>
    );

    return (
        <div className="page">
            <button className="back-link" onClick={backToMap} disabled={saving}>
                <ArrowLeftIcon size="sm" /> Back to map
            </button>
            <div className="page-head">
                <div>
                    <h1 className="page-title">Add a slipway</h1>
                    <p className="page-lead" style={{ marginBottom: 0 }}>Only the name is required. Add as much detail as you can to help other boaters.</p>
                </div>
            </div>

            <div className="add-layout">
                <form className="card form" onSubmit={handleSubmit}>
                    {error && <div className="alert alert--error" role="alert"><AlertIcon />{error}</div>}

                    <fieldset className="form-section">
                        <h3 className="form-section-title">Overview</h3>
                        <p className="form-section-desc">What is it called and what's it like?</p>
                        <div className="form-grid">
                            {text('name', 'Slipway name', 'e.g. Harbour Road Slipway', { full: true, required: true })}
                            {longText('description', 'Description', 'Describe the slipway')}
                            {text('nearestPlace', 'Nearest place', 'Town or landmark')}
                            {text('charges', 'Charges', 'e.g. Free, £5 per launch')}
                            {text('facilities', 'Facilities', 'Parking, Toilets, Café', { full: true, hint: 'Separate each facility with a comma' })}
                        </div>
                    </fieldset>

                    <fieldset className="form-section">
                        <h3 className="form-section-title">The ramp</h3>
                        <p className="form-section-desc">Helps people decide whether they can launch here.</p>
                        <div className="form-grid">
                            <label className="field">
                                <span className="field-label">Suitability</span>
                                <select className="select" value={formData.suitability} onChange={(e) => handleInputChange('suitability', e.target.value)}>
                                    <option value="">Select…</option>
                                    <option value="Large trailer needs a car">Large trailer needs a car</option>
                                    <option value="Small trailer can be pushed">Small trailer can be pushed</option>
                                    <option value="Portable Only">Portable Only</option>
                                </select>
                            </label>
                            <label className="field">
                                <span className="field-label">Ramp length</span>
                                <select className="select" value={formData.rampLength} onChange={(e) => handleInputChange('rampLength', e.target.value)}>
                                    <option value="">Select…</option>
                                    <option value="All of tidal range">All of tidal range</option>
                                    <option value="3/4 tidal">3/4 tidal</option>
                                    <option value="1/2 tidal">1/2 tidal</option>
                                    <option value="1/4 tidal">1/4 tidal</option>
                                    <option value="Non-tidal">Non-tidal</option>
                                </select>
                            </label>
                            {text('rampType', 'Ramp type', 'e.g. Concrete, Shingle, Sand')}
                            <div className="field" />
                            {area('upperArea', 'Upper area')}
                            {area('lowerArea', 'Lower area')}
                            {longText('navigationalHazards', 'Navigational hazards', 'Rocks, currents, moorings…')}
                        </div>
                    </fieldset>

                    <fieldset className="form-section">
                        <h3 className="form-section-title">Access & contact</h3>
                        <div className="form-grid">
                            {longText('directions', 'Directions', 'How to find the slipway')}
                            {text('email', 'Email', 'Contact email', { type: 'email' })}
                            {text('mobilePhoneNumber', 'Phone', 'Contact phone number', { type: 'tel' })}
                            {text('website', 'Website', 'https://', { type: 'url', full: true })}
                        </div>
                    </fieldset>

                    <div className="form-actions">
                        <button type="button" className="btn btn--secondary btn--lg" onClick={backToMap} disabled={saving}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn--primary btn--lg" disabled={saving || !formData.name.trim()}>
                            {saving ? <><span className="spinner" /> Saving…</> : <><CheckIcon size="sm" /> Save slipway</>}
                        </button>
                    </div>
                </form>

                <aside className="add-preview">
                    {storedLocation ? (
                        <>
                            <div className="add-preview-map">
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
                                    <Marker position={[storedLocation.latitude, storedLocation.longitude] as LatLngExpression} {...({ icon: newSlipwayIcon } as any)}>
                                        <Popup>New slipway location</Popup>
                                    </Marker>
                                </MapContainer>
                            </div>
                            <div className="coords">
                                <PinIcon size="sm" />
                                {storedLocation.latitude.toFixed(5)}, {storedLocation.longitude.toFixed(5)}
                            </div>
                        </>
                    ) : (
                        <div className="empty-state">
                            <PinIcon size="lg" />
                            <strong>No location selected</strong>
                            <span>Go back to the map, tap “Add slipway” and then tap where the slipway is.</span>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
};

export default AddSlipway;
