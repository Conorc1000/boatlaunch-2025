import React, { useState, useEffect } from 'react';
import { ref, get, set } from 'firebase/database';
import { database } from '../firebase';
import { Slipway, Comment } from '../types/Slipway';
import { useAuth } from '../hooks/useAuth';
import { fetchImgsService, generateImageId, validateImageFile } from '../services/fetchImgService';
import proxyUploadService from '../services/proxyUploadService';

interface SlipwayViewProps {
    slipwayId: string;
    slipwayData?: Slipway;
    onNavigate?: (view: string, data?: any) => void;
}

const SlipwayView: React.FC<SlipwayViewProps> = ({ slipwayId, slipwayData, onNavigate }) => {
    const [slipway, setSlipway] = useState<Slipway | null>(null);
    const [imageUrls, setImageUrls] = useState<{ src: string, id: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [newComment, setNewComment] = useState<string>('');
    const [newRating, setNewRating] = useState<number>(0);
    const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);
    const [editedSlipway, setEditedSlipway] = useState<Slipway | null>(null);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const { user } = useAuth();

    // Handle comment submission
    const handleSubmitComment = async (commentText: string, rating?: number) => {
        if (!commentText.trim() || !user || isSubmittingComment) return;

        try {
            setIsSubmittingComment(true);

            // Create new comment object
            const comment: Comment = {
                id: Date.now().toString(), // Simple ID generation
                userId: user.uid,
                userName: user.displayName || user.email || 'Anonymous',
                userEmail: user.email || '',
                text: commentText.trim(),
                timestamp: Date.now(),
                ...(rating && rating > 0 && { rating: rating })
            };

            // Update local state immediately for better UX
            const updatedSlipway = {
                ...slipway!,
                comments: [...(slipway!.comments || []), comment]
            };
            setSlipway(updatedSlipway);

            // Update Firebase
            const commentsRef = ref(database, `slipwayDetails/${slipwayId}/comments`);
            const updatedComments = [...(slipway!.comments || []), comment];
            await set(commentsRef, updatedComments);

            // Reset form
            setNewComment('');
            setNewRating(0);
            
        } catch (error) {
            console.error('Error submitting comment:', error);
            alert('Failed to submit comment. Please try again.');
        } finally {
            setIsSubmittingComment(false);
        }
    };

    useEffect(() => {
        const initializeSlipwayData = async () => {
            try {
                setLoading(true);
                setError(null);

                if (slipwayData) {
                    // Use passed data directly
                    setSlipway(slipwayData);
                    setEditedSlipway(slipwayData);

                    // Fetch and set image URLs
                    if (slipwayData.imgs && Array.isArray(slipwayData.imgs)) {
                        const images = fetchImgsService(slipwayData.imgs);
                        setImageUrls(images);
                    } else {
                        setImageUrls([]);
                    }

                    setLoading(false);
                } else {
                    // Fallback: fetch from Firebase if no data passed
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

                    const fetchedSlipwayData: Slipway = {
                        id: slipwayId,
                        name: details.Name || 'Unknown',
                        description: details.Description || 'No description available',
                        latitude: parseFloat(coords[0]),
                        longitude: parseFloat(coords[1]),
                        facilities: details.Facilities ? details.Facilities.split(', ').filter((f: string) => f.trim()) : [],
                        imgs: details.imgs || details.ImageIds || [],
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

                    setSlipway(fetchedSlipwayData);
                    setEditedSlipway(fetchedSlipwayData);

                    // Fetch and set image URLs
                    if (fetchedSlipwayData.imgs && Array.isArray(fetchedSlipwayData.imgs)) {
                        const images = fetchImgsService(fetchedSlipwayData.imgs);
                        setImageUrls(images);
                    } else {
                        setImageUrls([]);
                    }

                    setLoading(false);
                }
            } catch (err) {
                console.error('Error loading slipway data:', err);
                setError(err instanceof Error ? err.message : 'Failed to load slipway data');
                setLoading(false);
            }
        };

        initializeSlipwayData();
    }, [slipwayId, slipwayData]);

    const openImageModal = (imageUrl: string) => {
        setSelectedImageIndex(imageUrls.findIndex(image => image.src === imageUrl));
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

    const handleFieldChange = (field: keyof Slipway, value: string | string[]) => {
        if (editedSlipway) {
            setEditedSlipway({
                ...editedSlipway,
                [field]: value
            });
        }
    };

    const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            // Validate file
            const validation = validateImageFile(file);
            if (!validation.valid) {
                alert(validation.error);
                return;
            }

            setIsUploading(true);
            setUploadProgress(0);

            // Generate new image ID
            const newImageId = generateImageId(slipwayId);

            // Upload to S3 via proxy
            const uploadUrl = await proxyUploadService(
                file,
                newImageId,
                (progressMessage: string) => {
                    // Extract percentage from progress message if it contains one
                    const match = progressMessage.match(/(\d+)%/);
                    if (match) {
                        setUploadProgress(parseInt(match[1]));
                    }
                },
                undefined, // No success callback needed since we use await
                (error: string) => {
                    console.error('Upload error:', error);
                    alert('Upload failed. Please try again.');
                }
            );

            // Handle successful upload
            if (uploadUrl && slipway) {
                const updatedImgs = [...(slipway.imgs || []), newImageId];
                const updatedSlipway = {
                    ...slipway,
                    imgs: updatedImgs
                };
                
                // Update both slipway states
                setSlipway(updatedSlipway);
                setEditedSlipway(updatedSlipway);
                
                // Update image URLs immediately
                const newImages = fetchImgsService(updatedImgs);
                setImageUrls(newImages);

                // Save updated slipway to Firebase
                const slipwayRef = ref(database, `slipwayDetails/${slipwayId}`);
                await set(slipwayRef, updatedSlipway);
                
                console.log('Image uploaded and Firebase updated:', newImageId);
                
                // Small delay to ensure Firebase data propagates
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            setIsUploading(false);
            setUploadProgress(0);
        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload failed. Please try again.');
            setIsUploading(false);
            setUploadProgress(0);
        }

        // Reset file input
        event.target.value = '';
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
                            onClick={() => onNavigate && onNavigate('map', { refreshData: true })}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ color: '#2c3e50', margin: 0 }}>
                        📸 Photos ({imageUrls.length})
                    </h2>
                    
                    {!isEditing && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {isUploading && (
                                <span style={{ fontSize: '14px', color: '#007bff' }}>
                                    {uploadProgress}%
                                </span>
                            )}
                            <label
                                style={{
                                    backgroundColor: isUploading ? '#6c757d' : '#007bff',
                                    color: 'white',
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    cursor: isUploading ? 'not-allowed' : 'pointer',
                                    fontSize: '14px',
                                    border: 'none',
                                    display: 'inline-block'
                                }}
                            >
                                {isUploading ? '⏳ Uploading...' : '📤 Upload Photo'}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoUpload}
                                    disabled={isUploading}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                    )}
                </div>

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
                                    cursor: 'pointer',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                }}
                                onClick={() => setSelectedImageIndex(index)}
                            >
                                <img
                                    src={image.src}
                                    alt={`${slipway?.name} - Photo ${index + 1}`}
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
                        <div style={{ marginBottom: '15px' }}>
                            <strong>Ramp Type:</strong>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editedSlipway?.rampType || ''}
                                    onChange={(e) => handleFieldChange('rampType', e.target.value)}
                                    style={{
                                        marginLeft: '10px',
                                        padding: '4px 8px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        backgroundColor: 'white',
                                        width: '200px'
                                    }}
                                    placeholder="Enter ramp type (e.g., Concrete, Shingle, Sand)..."
                                />
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
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        width: '220px'
                                    }}
                                >
                                    <option value="">Select suitability...</option>
                                    <option value="Large trailer needs a car">Large trailer needs a car</option>
                                    <option value="Small trailer can be pushed">Small trailer can be pushed</option>
                                    <option value="Portable Only">Portable Only</option>
                                </select>
                            ) : (
                                <span> {slipway.suitability}</span>
                            )}
                        </div>

                        {/* Ramp Length */}
                        <div style={{ margin: '10px 0' }}>
                            <strong>Ramp Length:</strong>
                            {isEditing ? (
                                <select
                                    value={editedSlipway?.rampLength || ''}
                                    onChange={(e) => handleFieldChange('rampLength', e.target.value)}
                                    style={{
                                        marginLeft: '10px',
                                        padding: '4px 8px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        width: '200px',
                                        backgroundColor: 'white'
                                    }}
                                >
                                    <option value="">Select ramp length...</option>
                                    <option value="All of tidal range">All of tidal range</option>
                                    <option value="3/4 tidal">3/4 tidal</option>
                                    <option value="1/2 tidal">1/2 tidal</option>
                                    <option value="1/4 tidal">1/4 tidal</option>
                                    <option value="Non-tidal">Non-tidal</option>
                                </select>
                            ) : (
                                <span> {slipway.rampLength || 'Not specified'}</span>
                            )}
                        </div>

                        {/* Upper Area */}
                        <div style={{ marginBottom: '15px' }}>
                            <strong>Upper Area:</strong>
                            {isEditing ? (
                                <select
                                    value={editedSlipway?.upperArea || ''}
                                    onChange={(e) => handleFieldChange('upperArea', e.target.value)}
                                    style={{
                                        marginLeft: '10px',
                                        padding: '4px 8px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        backgroundColor: 'white'
                                    }}
                                >
                                    <option value="">Select upper area...</option>
                                    <option value="Harbour">Harbour</option>
                                    <option value="Shingle">Shingle</option>
                                    <option value="Concrete">Concrete</option>
                                    <option value="Sand">Sand</option>
                                    <option value="Rock">Rock</option>
                                    <option value="Mud">Mud</option>
                                </select>
                            ) : (
                                <span> {slipway.upperArea || 'Not specified'}</span>
                            )}
                        </div>

                        {/* Lower Area */}
                        <div style={{ marginBottom: '15px' }}>
                            <strong>Lower Area:</strong>
                            {isEditing ? (
                                <select
                                    value={editedSlipway?.lowerArea || ''}
                                    onChange={(e) => handleFieldChange('lowerArea', e.target.value)}
                                    style={{
                                        marginLeft: '10px',
                                        padding: '4px 8px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        backgroundColor: 'white'
                                    }}
                                >
                                    <option value="">Select lower area...</option>
                                    <option value="Harbour">Harbour</option>
                                    <option value="Shingle">Shingle</option>
                                    <option value="Concrete">Concrete</option>
                                    <option value="Sand">Sand</option>
                                    <option value="Rock">Rock</option>
                                    <option value="Mud">Mud</option>
                                </select>
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

                        {/* Comments Section - TEMPORARILY DISABLED */}
                        {/*
                        <div style={{ marginTop: '30px', borderTop: '2px solid #e9ecef', paddingTop: '20px' }}>
                            <h3 style={{ margin: '0 0 20px 0', color: '#2c3e50', fontSize: '20px' }}>
                                Comments & Reviews ({slipway.comments?.length || 0})
                            </h3>

                            {/* Add Comment Form - Only for authenticated users */}
                            {/*
                            {user && (
                                <div style={{
                                    backgroundColor: '#f8f9fa',
                                    padding: '20px',
                                    borderRadius: '8px',
                                    marginBottom: '20px',
                                    border: '1px solid #e9ecef'
                                }}>
                                    <h4 style={{ margin: '0 0 15px 0', color: '#495057', fontSize: '16px' }}>
                                        Add Your Comment
                                    </h4>
                                    
                                    {/* Rating Stars */}
                                    {/*
                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={{ display: 'block', fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                                            Rating (optional):
                                        </label>
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    onClick={() => setNewRating(star)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        fontSize: '24px',
                                                        cursor: 'pointer',
                                                        color: star <= newRating ? '#ffc107' : '#dee2e6',
                                                        padding: '0',
                                                        lineHeight: '1'
                                                    }}
                                                >
                                                    ★
                                                </button>
                                            ))}
                                            {newRating > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setNewRating(0)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        fontSize: '12px',
                                                        cursor: 'pointer',
                                                        color: '#6c757d',
                                                        marginLeft: '10px'
                                                    }}
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Comment Text */}
                                    {/*
                                    <textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Share your experience with this slipway..."
                                        style={{
                                            width: '100%',
                                            minHeight: '100px',
                                            padding: '12px',
                                            border: '1px solid #ced4da',
                                            borderRadius: '4px',
                                            fontSize: '14px',
                                            fontFamily: 'inherit',
                                            resize: 'vertical',
                                            marginBottom: '15px'
                                        }}
                                    />

                                    {/* Submit Button */}
                                    {/*
                                    <button
                                        onClick={handleSubmitComment}
                                        disabled={!newComment.trim() || isSubmittingComment}
                                        style={{
                                            backgroundColor: newComment.trim() && !isSubmittingComment ? '#28a745' : '#6c757d',
                                            color: 'white',
                                            border: 'none',
                                            padding: '10px 20px',
                                            borderRadius: '4px',
                                            cursor: newComment.trim() && !isSubmittingComment ? 'pointer' : 'not-allowed',
                                            fontSize: '14px',
                                            fontWeight: '500'
                                        }}
                                    >
                                        {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                                    </button>
                                </div>
                            )}

                            {/* Comments List */}
                            {/*
                            <div>
                                {slipway.comments && slipway.comments.length > 0 ? (
                                    slipway.comments
                                        .sort((a, b) => b.timestamp - a.timestamp)
                                        .map((comment) => (
                                            <div
                                                key={comment.id}
                                                style={{
                                                    backgroundColor: 'white',
                                                    border: '1px solid #e9ecef',
                                                    borderRadius: '8px',
                                                    padding: '15px',
                                                    marginBottom: '15px'
                                                }}
                                            >
                                                {/* Comment Header */}
                                                {/*
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    marginBottom: '10px'
                                                }}>
                                                    <div>
                                                        <strong style={{ color: '#2c3e50', fontSize: '14px' }}>
                                                            {comment.userName}
                                                        </strong>
                                                        {comment.rating && (
                                                            <div style={{ display: 'inline-block', marginLeft: '10px' }}>
                                                                {[1, 2, 3, 4, 5].map((star) => (
                                                                    <span
                                                                        key={star}
                                                                        style={{
                                                                            color: star <= comment.rating! ? '#ffc107' : '#dee2e6',
                                                                            fontSize: '16px'
                                                                        }}
                                                                    >
                                                                        ★
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: '12px', color: '#6c757d' }}>
                                                        {new Date(comment.timestamp).toLocaleDateString()}
                                                    </span>
                                                </div>

                                                {/* Comment Text */}
                                                {/*
                                                <p style={{
                                                    margin: '0',
                                                    fontSize: '14px',
                                                    color: '#495057',
                                                    lineHeight: '1.5'
                                                }}>
                                                    {comment.text}
                                                </p>
                                            </div>
                                        ))
                                ) : (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '40px',
                                        color: '#6c757d',
                                        fontStyle: 'italic'
                                    }}>
                                        No comments yet. Be the first to share your experience!
                                    </div>
                                )}
                            </div>
                        </div>
                        */}
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
                    zIndex: 3000
                }}>
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                        <img
                            src={imageUrls[selectedImageIndex]?.src}
                            alt={`${slipway?.name} - Photo ${selectedImageIndex + 1}`}
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
