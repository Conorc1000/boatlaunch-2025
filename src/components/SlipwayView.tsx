import React, { useState, useEffect } from 'react';
import { ref, get, set } from 'firebase/database';
import { database } from '../firebase.ts';
import { Slipway } from '../types/Slipway.ts';
import { fetchImgsService } from '../services/fetchImgService.ts';

interface SlipwayViewProps {
    slipwayId: string;
    onNavigate?: (view: string) => void;
}

const SlipwayView: React.FC<SlipwayViewProps> = ({ slipwayId, onNavigate }) => {
    const [slipway, setSlipway] = useState<Slipway | null>(null);
    const [imageUrls, setImageUrls] = useState<{src: string, id: string}[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedSlipway, setEditedSlipway] = useState<Slipway | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSlipwayData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Fetch slipway details from Firebase
                const latLngsRef = ref(database, 'latLngs');
                const detailsRef = ref(database, 'slipwayDetails');

                const [latLngsSnapshot, detailsSnapshot] = await Promise.all([
                    get(latLngsRef),
                    get(detailsRef)
                ]);

                const latLngsData = latLngsSnapshot.val();
                const detailsData = detailsSnapshot.val();

                if (!latLngsData || !detailsData) {
                    throw new Error('Failed to load slipway data');
                }

                const coords = latLngsData[slipwayId];
                const details = detailsData[slipwayId];

                if (!coords || !details) {
                    throw new Error('Slipway not found');
                }

                const slipwayData: Slipway = {
                    id: slipwayId,
                    name: details.Name || 'Unknown',
                    description: details.RampDescription || details.Description || 'No description available',
                    latitude: parseFloat(coords[0]),
                    longitude: parseFloat(coords[1]),
                    facilities: details.Facilities ? details.Facilities.split(', ').filter((f: string) => f.trim()) : [],
                    charges: details.Charges || '',
                    nearestPlace: details.NearestPlace || '',
                    rampType: details.RampType || '',
                    suitability: details.Suitability || '',
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

                setSlipway(slipwayData);
                setEditedSlipway(slipwayData);

                // Fetch and set image URLs
                if (details.ImageIds && Array.isArray(details.ImageIds)) {
                    const images = fetchImgsService(details.ImageIds);
                    setImageUrls(images);
                } else {
                    setImageUrls([]);
                }

            } catch (err) {
                console.error('Error fetching slipway data:', err);
                setError('Failed to load slipway data. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchSlipwayData();
    }, [slipwayId]);

    const openImageModal = (index: number) => {
        setSelectedImageIndex(index);
    };

    const closeImageModal = () => {
        setSelectedImageIndex(null);
    };

    const navigateImage = (direction: 'prev' | 'next') => {
        if (selectedImageIndex === null) return;
        
        if (direction === 'prev') {
            setSelectedImageIndex(selectedImageIndex > 0 ? selectedImageIndex - 1 : imageUrls.length - 1);
        } else {
            setSelectedImageIndex(selectedImageIndex < imageUrls.length - 1 ? selectedImageIndex + 1 : 0);
        }
    };

    const handleEdit = () => {
        setIsEditing(true);
        setEditedSlipway(slipway ? { ...slipway } : null);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditedSlipway(slipway);
    };

    const handleSave = async () => {
        if (!editedSlipway || !slipway) return;

        try {
            setSaving(true);
            setError(null);

            // Update Firebase with edited data
            const detailsRef = ref(database, `slipwayDetails/${slipwayId}`);
            const updatedDetails = {
                Name: editedSlipway.name,
                Description: editedSlipway.description,
                RampDescription: editedSlipway.rampDescription || editedSlipway.description,
                Facilities: editedSlipway.facilities?.join(', ') || '',
                Charges: editedSlipway.charges,
                NearestPlace: editedSlipway.nearestPlace,
                RampType: editedSlipway.rampType,
                Suitability: editedSlipway.suitability,
                Directions: editedSlipway.directions,
                Email: editedSlipway.email,
                LowerArea: editedSlipway.lowerArea,
                MobilePhoneNumber: editedSlipway.mobilePhoneNumber,
                NavigationalHazards: editedSlipway.navigationalHazards,
                RampLength: editedSlipway.rampLength,
                UpperArea: editedSlipway.upperArea,
                Website: editedSlipway.website
            };

            await set(detailsRef, updatedDetails);

            // Update local state
            setSlipway(editedSlipway);
            setIsEditing(false);
        } catch (err) {
            console.error('Error saving slipway data:', err);
            setError('Failed to save changes. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleFieldChange = (field: keyof Slipway, value: any) => {
        if (!editedSlipway) return;
        setEditedSlipway({
            ...editedSlipway,
            [field]: value
        });
    };

    const handleFacilitiesChange = (facilitiesText: string) => {
        const facilities = facilitiesText.split(',').map(f => f.trim()).filter(f => f);
        handleFieldChange('facilities', facilities);
    };

    if (loading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', color: '#666' }}>Loading slipway details...</div>
            </div>
        );
    }

    if (error || !slipway) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ color: '#d32f2f', marginBottom: '20px' }}>{error || 'Slipway not found'}</div>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    {isEditing ? (
                        <input
                            type="text"
                            value={editedSlipway?.name || ''}
                            onChange={(e) => handleFieldChange('name', e.target.value)}
                            style={{
                                fontSize: '32px',
                                fontWeight: 'bold',
                                color: '#2c3e50',
                                border: '2px solid #3498db',
                                borderRadius: '4px',
                                padding: '8px 12px',
                                background: 'white',
                                flex: 1,
                                marginRight: '20px'
                            }}
                        />
                    ) : (
                        <h1 style={{ margin: 0, color: '#2c3e50' }}>{slipway.name}</h1>
                    )}
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {isEditing ? (
                            <>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    style={{
                                        backgroundColor: saving ? '#95a5a6' : '#27ae60',
                                        color: 'white',
                                        border: 'none',
                                        padding: '8px 16px',
                                        borderRadius: '4px',
                                        cursor: saving ? 'not-allowed' : 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    {saving ? 'Saving...' : '✓ Save'}
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={saving}
                                    style={{
                                        backgroundColor: '#e74c3c',
                                        color: 'white',
                                        border: 'none',
                                        padding: '8px 16px',
                                        borderRadius: '4px',
                                        cursor: saving ? 'not-allowed' : 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    ✕ Cancel
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleEdit}
                                style={{
                                    backgroundColor: '#3498db',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    marginRight: '10px'
                                }}
                            >
                                ✏️ Edit
                            </button>
                        )}
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
                </div>
                
                {isEditing ? (
                    <textarea
                        value={editedSlipway?.description || ''}
                        onChange={(e) => handleFieldChange('description', e.target.value)}
                        style={{
                            width: '100%',
                            minHeight: '80px',
                            fontSize: '16px',
                            color: '#666',
                            border: '2px solid #3498db',
                            borderRadius: '4px',
                            padding: '8px 12px',
                            resize: 'vertical',
                            fontFamily: 'inherit'
                        }}
                        placeholder="Enter slipway description..."
                    />
                ) : (
                    <p style={{ margin: '10px 0', fontSize: '16px', color: '#666' }}>{slipway.description}</p>
                )}
            </div>

            {/* Photos Section */}
            <div style={{ marginBottom: '30px' }}>
                <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>
                    📸 Photos ({imageUrls.length})
                </h2>
                
                {imageUrls.length === 0 ? (
                    <div style={{ 
                        padding: '40px', 
                        textAlign: 'center', 
                        backgroundColor: '#f8f9fa', 
                        borderRadius: '8px',
                        border: '2px dashed #dee2e6'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '10px' }}>📷</div>
                        <div style={{ fontSize: '18px', color: '#6c757d' }}>No photos available</div>
                        <div style={{ fontSize: '14px', color: '#adb5bd', marginTop: '5px' }}>
                            Photos will appear here once uploaded
                        </div>
                    </div>
                ) : (
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
                        gap: '20px' 
                    }}>
                        {imageUrls.map((image, index) => (
                            <div
                                key={image.id}
                                style={{
                                    position: 'relative',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s ease'
                                }}
                                onClick={() => openImageModal(index)}
                                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <img
                                    src={image.src}
                                    alt={`${slipway.name} - Photo ${index + 1}`}
                                    style={{
                                        width: '100%',
                                        height: '200px',
                                        objectFit: 'cover',
                                        display: 'block'
                                    }}
                                    onError={(e) => {
                                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=';
                                    }}
                                />
                                <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                    color: 'white',
                                    padding: '10px',
                                    fontSize: '12px'
                                }}>
                                    Photo {index + 1} of {imageUrls.length}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Slipway Details */}
            <div style={{ 
                backgroundColor: '#f8f9fa', 
                padding: '20px', 
                borderRadius: '8px',
                border: '1px solid #e9ecef'
            }}>
                <h2 style={{ color: '#2c3e50', marginBottom: '20px' }}>Slipway Details</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    <div>
                        {/* Facilities */}
                        <div style={{ marginBottom: '15px' }}>
                            <strong>Facilities:</strong>
                            {isEditing ? (
                                <textarea
                                    value={editedSlipway?.facilities?.join(', ') || ''}
                                    onChange={(e) => handleFacilitiesChange(e.target.value)}
                                    style={{
                                        width: '100%',
                                        minHeight: '60px',
                                        marginTop: '5px',
                                        padding: '8px',
                                        border: '2px solid #3498db',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        fontFamily: 'inherit'
                                    }}
                                    placeholder="Enter facilities separated by commas..."
                                />
                            ) : (
                                slipway.facilities && slipway.facilities.length > 0 ? (
                                    <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                                        {slipway.facilities.map((facility, index) => (
                                            <li key={index}>{facility}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p style={{ margin: '5px 0', color: '#999', fontStyle: 'italic' }}>No facilities listed</p>
                                )
                            )}
                        </div>


                        {/* Charges */}
                        <div style={{ margin: '10px 0' }}>
                            <strong>Charges:</strong>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editedSlipway?.charges || ''}
                                    onChange={(e) => handleFieldChange('charges', e.target.value)}
                                    style={{
                                        marginLeft: '10px',
                                        padding: '4px 8px',
                                        border: '2px solid #3498db',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        width: '200px'
                                    }}
                                    placeholder="Enter charges..."
                                />
                            ) : (
                                <span> {slipway.charges}</span>
                            )}
                        </div>

                        {/* Nearest Place */}
                        <div style={{ margin: '10px 0' }}>
                            <strong>Nearest Place:</strong>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editedSlipway?.nearestPlace || ''}
                                    onChange={(e) => handleFieldChange('nearestPlace', e.target.value)}
                                    style={{
                                        marginLeft: '10px',
                                        padding: '4px 8px',
                                        border: '2px solid #3498db',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        width: '200px'
                                    }}
                                    placeholder="Enter nearest place..."
                                />
                            ) : (
                                <span> {slipway.nearestPlace}</span>
                            )}
                        </div>

                        {/* Ramp Description */}
                        <div style={{ marginBottom: '15px' }}>
                            <strong>Ramp Description:</strong>
                            {isEditing ? (
                                <textarea
                                    value={editedSlipway?.rampDescription || ''}
                                    onChange={(e) => handleFieldChange('rampDescription', e.target.value)}
                                    style={{
                                        width: '100%',
                                        minHeight: '60px',
                                        marginTop: '5px',
                                        padding: '8px',
                                        border: '2px solid #3498db',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        fontFamily: 'inherit'
                                    }}
                                    placeholder="Enter ramp description..."
                                />
                            ) : (
                                <p style={{ margin: '5px 0', color: slipway.rampDescription ? '#333' : '#999', fontStyle: slipway.rampDescription ? 'normal' : 'italic' }}>
                                    {slipway.rampDescription || 'No ramp description available'}
                                </p>
                            )}
                        </div>
                    </div>
                    
                    <div>
                        {/* Ramp Type */}
                        <div style={{ margin: '10px 0' }}>
                            <strong>Ramp Type:</strong>
                            {isEditing ? (
                                <select
                                    value={editedSlipway?.rampType || ''}
                                    onChange={(e) => handleFieldChange('rampType', e.target.value)}
                                    style={{
                                        marginLeft: '10px',
                                        padding: '4px 8px',
                                        border: '2px solid #3498db',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        width: '220px'
                                    }}
                                >
                                    <option value="">Select ramp type...</option>
                                    <option value="Concrete">Concrete</option>
                                    <option value="Gravel">Gravel</option>
                                    <option value="Sand">Sand</option>
                                    <option value="Rock">Rock</option>
                                    <option value="Timber">Timber</option>
                                    <option value="Floating">Floating</option>
                                    <option value="Natural">Natural</option>
                                    <option value="Other">Other</option>
                                </select>
                            ) : (
                                <span> {slipway.rampType}</span>
                            )}
                        </div>

                        {/* Suitability */}
                        <div style={{ margin: '10px 0' }}>
                            <strong>Suitability:</strong>
                            {isEditing ? (
                                <select
                                    value={editedSlipway?.suitability || ''}
                                    onChange={(e) => handleFieldChange('suitability', e.target.value)}
                                    style={{
                                        marginLeft: '10px',
                                        padding: '4px 8px',
                                        border: '2px solid #3498db',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        width: '220px'
                                    }}
                                >
                                    <option value="">Select suitability...</option>
                                    <option value="Small boats only">Small boats only</option>
                                    <option value="Small to medium boats">Small to medium boats</option>
                                    <option value="All boat sizes">All boat sizes</option>
                                    <option value="Kayaks/Canoes">Kayaks/Canoes</option>
                                    <option value="Jet skis">Jet skis</option>
                                    <option value="Sailing boats">Sailing boats</option>
                                    <option value="Motor boats">Motor boats</option>
                                    <option value="Commercial vessels">Commercial vessels</option>
                                    <option value="4WD access required">4WD access required</option>
                                    <option value="Trailer boats">Trailer boats</option>
                                </select>
                            ) : (
                                <span> {slipway.suitability}</span>
                            )}
                        </div>

                        {/* Ramp Length */}
                        <div style={{ margin: '10px 0' }}>
                            <strong>Ramp Length:</strong>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editedSlipway?.rampLength || ''}
                                    onChange={(e) => handleFieldChange('rampLength', e.target.value)}
                                    style={{
                                        marginLeft: '10px',
                                        padding: '4px 8px',
                                        border: '2px solid #3498db',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        width: '200px'
                                    }}
                                    placeholder="Enter ramp length..."
                                />
                            ) : (
                                <span> {slipway.rampLength || 'Not specified'}</span>
                            )}
                        </div>

                        {/* Upper Area */}
                        <div style={{ margin: '10px 0' }}>
                            <strong>Upper Area:</strong>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editedSlipway?.upperArea || ''}
                                    onChange={(e) => handleFieldChange('upperArea', e.target.value)}
                                    style={{
                                        marginLeft: '10px',
                                        padding: '4px 8px',
                                        border: '2px solid #3498db',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        width: '200px'
                                    }}
                                    placeholder="Enter upper area details..."
                                />
                            ) : (
                                <span> {slipway.upperArea || 'Not specified'}</span>
                            )}
                        </div>

                        {/* Lower Area */}
                        <div style={{ margin: '10px 0' }}>
                            <strong>Lower Area:</strong>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editedSlipway?.lowerArea || ''}
                                    onChange={(e) => handleFieldChange('lowerArea', e.target.value)}
                                    style={{
                                        marginLeft: '10px',
                                        padding: '4px 8px',
                                        border: '2px solid #3498db',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        width: '200px'
                                    }}
                                    placeholder="Enter lower area details..."
                                />
                            ) : (
                                <span> {slipway.lowerArea || 'Not specified'}</span>
                            )}
                        </div>

                        {/* Navigational Hazards */}
                        <div style={{ marginBottom: '15px' }}>
                            <strong>Navigational Hazards:</strong>
                            {isEditing ? (
                                <textarea
                                    value={editedSlipway?.navigationalHazards || ''}
                                    onChange={(e) => handleFieldChange('navigationalHazards', e.target.value)}
                                    style={{
                                        width: '100%',
                                        minHeight: '60px',
                                        marginTop: '5px',
                                        padding: '8px',
                                        border: '2px solid #3498db',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        fontFamily: 'inherit'
                                    }}
                                    placeholder="Enter navigational hazards..."
                                />
                            ) : (
                                <p style={{ margin: '5px 0', color: slipway.navigationalHazards ? '#333' : '#999', fontStyle: slipway.navigationalHazards ? 'normal' : 'italic' }}>
                                    {slipway.navigationalHazards || 'No navigational hazards noted'}
                                </p>
                            )}
                        </div>
                    </div>
                    
                    <div>
                        {/* Directions */}
                        <div style={{ marginBottom: '15px' }}>
                            <strong>Directions:</strong>
                            {isEditing ? (
                                <textarea
                                    value={editedSlipway?.directions || ''}
                                    onChange={(e) => handleFieldChange('directions', e.target.value)}
                                    style={{
                                        width: '100%',
                                        minHeight: '60px',
                                        marginTop: '5px',
                                        padding: '8px',
                                        border: '2px solid #3498db',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        fontFamily: 'inherit'
                                    }}
                                    placeholder="Enter directions..."
                                />
                            ) : (
                                <p style={{ margin: '5px 0', color: slipway.directions ? '#333' : '#999', fontStyle: slipway.directions ? 'normal' : 'italic' }}>
                                    {slipway.directions || 'No directions available'}
                                </p>
                            )}
                        </div>

                        {/* Email */}
                        <div style={{ margin: '10px 0' }}>
                            <strong>Email:</strong>
                            {isEditing ? (
                                <input
                                    type="email"
                                    value={editedSlipway?.email || ''}
                                    onChange={(e) => handleFieldChange('email', e.target.value)}
                                    style={{
                                        marginLeft: '10px',
                                        padding: '4px 8px',
                                        border: '2px solid #3498db',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        width: '200px'
                                    }}
                                    placeholder="Enter email address..."
                                />
                            ) : (
                                <span> {slipway.email ? <a href={`mailto:${slipway.email}`} style={{ color: '#3498db' }}>{slipway.email}</a> : 'Not provided'}</span>
                            )}
                        </div>

                        {/* Mobile Phone */}
                        <div style={{ margin: '10px 0' }}>
                            <strong>Mobile Phone:</strong>
                            {isEditing ? (
                                <input
                                    type="tel"
                                    value={editedSlipway?.mobilePhoneNumber || ''}
                                    onChange={(e) => handleFieldChange('mobilePhoneNumber', e.target.value)}
                                    style={{
                                        marginLeft: '10px',
                                        padding: '4px 8px',
                                        border: '2px solid #3498db',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        width: '200px'
                                    }}
                                    placeholder="Enter phone number..."
                                />
                            ) : (
                                <span> {slipway.mobilePhoneNumber ? <a href={`tel:${slipway.mobilePhoneNumber}`} style={{ color: '#3498db' }}>{slipway.mobilePhoneNumber}</a> : 'Not provided'}</span>
                            )}
                        </div>

                        {/* Website */}
                        <div style={{ margin: '10px 0' }}>
                            <strong>Website:</strong>
                            {isEditing ? (
                                <input
                                    type="url"
                                    value={editedSlipway?.website || ''}
                                    onChange={(e) => handleFieldChange('website', e.target.value)}
                                    style={{
                                        marginLeft: '10px',
                                        padding: '4px 8px',
                                        border: '2px solid #3498db',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        width: '200px'
                                    }}
                                    placeholder="Enter website URL..."
                                />
                            ) : (
                                <span> {slipway.website ? <a href={slipway.website.startsWith('http') ? slipway.website : `https://${slipway.website}`} target="_blank" rel="noopener noreferrer" style={{ color: '#3498db' }}>{slipway.website}</a> : 'Not provided'}</span>
                            )}
                        </div>

                        {/* Coordinates - Read only */}
                        <p style={{ margin: '10px 0' }}>
                            <strong>Coordinates:</strong> {slipway.latitude.toFixed(6)}, {slipway.longitude.toFixed(6)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Image Modal */}
            {selectedImageIndex !== null && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                        <img
                            src={imageUrls[selectedImageIndex].src}
                            alt={`${slipway.name} - Photo ${selectedImageIndex + 1}`}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain'
                            }}
                        />
                        
                        {/* Close button */}
                        <button
                            onClick={closeImageModal}
                            style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '40px',
                                height: '40px',
                                fontSize: '20px',
                                cursor: 'pointer'
                            }}
                        >
                            ×
                        </button>
                        
                        {/* Navigation buttons */}
                        {imageUrls.length > 1 && (
                            <>
                                <button
                                    onClick={() => navigateImage('prev')}
                                    style={{
                                        position: 'absolute',
                                        left: '10px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '40px',
                                        height: '40px',
                                        fontSize: '20px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ‹
                                </button>
                                <button
                                    onClick={() => navigateImage('next')}
                                    style={{
                                        position: 'absolute',
                                        right: '10px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '40px',
                                        height: '40px',
                                        fontSize: '20px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ›
                                </button>
                            </>
                        )}
                        
                        {/* Image counter */}
                        <div style={{
                            position: 'absolute',
                            bottom: '10px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            color: 'white',
                            padding: '5px 10px',
                            borderRadius: '15px',
                            fontSize: '14px'
                        }}>
                            {selectedImageIndex + 1} of {imageUrls.length}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SlipwayView;
