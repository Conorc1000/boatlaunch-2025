import React, { useState, useEffect } from 'react';
import { ref, get, set, update, serverTimestamp } from 'firebase/database';
import { database } from '../firebase';
import { Slipway } from '../types/Slipway';
import { useAuth } from '../hooks/useAuth';
import { formatPhotoDate, generateImageId, ImageUrl, loadImgsWithMeta, PhotoMeta, THUMB_SUFFIX, validateImageFile } from '../services/fetchImgService';
import { createThumbnail, readPhotoTakenAt } from '../services/photoProcessing';
import proxyUploadService from '../services/proxyUploadService';
import SlipwayComments from './SlipwayComments';
import SuggestRemoval from './SuggestRemoval';
import { OsmSourceSection } from './osmDetails';
import { promotedIdFor, promoteOsmSlipway } from '../services/promoteOsmSlipway';
import { attributionFor, formatShortDate } from '../services/attribution';
import { archivePhoto } from '../services/archivePhoto';
import {
    AlertIcon, ArchiveIcon, ArrowLeftIcon, CameraIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, EditIcon, GlobeIcon,
    CopyIcon, LayersIcon, MapIcon, PhoneIcon, PinIcon, RulerIcon, TagIcon, TruckIcon, UploadIcon, XIcon, StreetViewIcon
} from './Icons';

interface SlipwayViewProps {
    slipwayId: string;
    slipwayData?: Slipway;
    onNavigate?: (view: string, data?: any) => void;
    variant?: 'page' | 'modal';
    // Called after every saved edit or photo so the parent's copy stays current; promotedFromOsmId is set
    // when that save turned an OSM import into a Boatlaunch slipway (which changes its ID)
    onSaved?: (slipway: Slipway, promotedFromOsmId?: string) => void;
}

const SlipwayView: React.FC<SlipwayViewProps> = ({ slipwayId, slipwayData, onNavigate, variant = 'page', onSaved }) => {
    const [slipway, setSlipway] = useState<Slipway | null>(null);
    const [imageUrls, setImageUrls] = useState<ImageUrl[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [editedSlipway, setEditedSlipway] = useState<Slipway | null>(null);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    // Raw text for the facilities field so commas survive while typing
    const [facilitiesText, setFacilitiesText] = useState('');
    const [coordsCopied, setCoordsCopied] = useState(false);
    const [archiving, setArchiving] = useState(false);

    const { user } = useAuth();

    useEffect(() => {
        const initializeSlipwayData = async () => {
            try {
                setLoading(true);
                setError(null);

                if (slipwayData) {
                    // Use passed data directly
                    setSlipway(slipwayData);
                    setEditedSlipway(slipwayData);
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
                        createdBy: details.createdBy,
                        createdAt: details.createdAt,
                        updatedBy: details.updatedBy,
                        updatedAt: details.updatedAt,
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

    // Load photo URLs plus their metadata (dates, thumbnails) whenever the image list changes
    const imgs = slipway?.imgs;
    useEffect(() => {
        let cancelled = false;
        loadImgsWithMeta(Array.isArray(imgs) ? imgs : []).then((images) => {
            if (!cancelled) setImageUrls(images);
        });
        return () => { cancelled = true; };
    }, [imgs]);

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
        // Check if user is authenticated before allowing edit
        if (!user) {
            onNavigate && onNavigate('signin');
            return;
        }
        setIsEditing(true);
        setEditedSlipway(slipway ? { ...slipway } : null);
        setFacilitiesText(slipway?.facilities?.join(', ') || '');
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditedSlipway(slipway);
    };

    const handleSave = async () => {
        if (!editedSlipway || !slipway) return;

        // Check if user is authenticated
        if (!user) {
            setError('You must be signed in to save changes.');
            return;
        }

        try {
            setSaving(true);
            setError(null);

            // First edit of an OSM import creates the Boatlaunch slipway instead of updating one
            if (slipway.osm) {
                const promoted = await promoteOsmSlipway({ ...editedSlipway, osm: slipway.osm }, user);
                setSlipway(promoted);
                setEditedSlipway(promoted);
                setIsEditing(false);
                onSaved?.(promoted, slipway.osm.id);
                return;
            }

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
                Website: editedSlipway.website,
                updatedBy: attributionFor(user),
                updatedAt: serverTimestamp()
            };

            // update() rather than set(): only the edited fields change, so imgs, idKey and other
            // fields the form doesn't manage are preserved
            await update(detailsRef, updatedDetails);

            // Update local state
            const savedSlipway = { ...editedSlipway, updatedBy: updatedDetails.updatedBy, updatedAt: Date.now() };
            setSlipway(savedSlipway);
            onSaved?.(savedSlipway);
            setIsEditing(false);
        } catch (err) {
            console.error('Error saving slipway data:', err);
            if (err instanceof Error && err.message.includes('PERMISSION_DENIED')) {
                setError('Permission denied. Please sign in and try again.');
            } else {
                setError('Failed to save changes. Please try again.');
            }
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
        if (!file || !user) return;

        try {
            // Validate file
            const validation = validateImageFile(file);
            if (!validation.valid) {
                alert(validation.error);
                return;
            }

            setIsUploading(true);
            setUploadProgress(0);

            // Generate new image ID; an OSM import's photo belongs to the slipway it's about to become
            const newImageId = generateImageId(slipway?.osm ? promotedIdFor(slipway.osm) : slipwayId);

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
                // Thumbnail and capture date are nice-to-haves; the photo is saved even if they fail
                // uploadedAt is a server-timestamp placeholder until Firebase resolves it to a number
                const meta: Omit<PhotoMeta, 'uploadedAt'> & { uploadedAt: object } = {
                    uploadedBy: attributionFor(user),
                    uploadedAt: serverTimestamp()
                };
                const takenAt = await readPhotoTakenAt(file);
                if (takenAt) meta.takenAt = takenAt;
                try {
                    const thumbnail = await createThumbnail(file);
                    await proxyUploadService(thumbnail, newImageId, undefined, undefined, undefined, THUMB_SUFFIX);
                    meta.thumb = true;
                } catch (thumbError) {
                    console.warn('Thumbnail upload failed, gallery will use the full-size photo:', thumbError);
                }
                await set(ref(database, `photoMeta/${newImageId}`), meta);

                const updatedImgs = [...(slipway.imgs || []), newImageId];

                // First photo on an OSM import creates the Boatlaunch slipway
                if (slipway.osm) {
                    const promoted = await promoteOsmSlipway({ ...slipway, imgs: updatedImgs }, user);
                    setSlipway(promoted);
                    setEditedSlipway(promoted);
                    onSaved?.(promoted, slipway.osm.id);
                    setIsUploading(false);
                    setUploadProgress(0);
                    event.target.value = '';
                    return;
                }

                const updatedSlipway = {
                    ...slipway,
                    imgs: updatedImgs
                };

                // Update both slipway states; the imgs effect reloads the gallery
                setSlipway(updatedSlipway);
                setEditedSlipway(updatedSlipway);

                // Update only the imgs field in Firebase to preserve other data
                const slipwayRef = ref(database, `slipwayDetails/${slipwayId}`);
                await update(slipwayRef, { imgs: updatedImgs });
                onSaved?.(updatedSlipway);

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

    const handleArchivePhoto = async () => {
        const image = selectedImageIndex !== null ? imageUrls[selectedImageIndex] : undefined;
        if (!image || !slipway || !user || slipway.osm) return;
        if (!window.confirm('Remove this photo from the slipway?')) return;

        try {
            setArchiving(true);
            const remaining = await archivePhoto(slipwayId, slipway.imgs || [], image.id, user);
            const updatedSlipway = { ...slipway, imgs: remaining, updatedBy: attributionFor(user), updatedAt: Date.now() };
            setImageUrls(prev => prev.filter(img => img.id !== image.id));
            setSelectedImageIndex(remaining.length === 0 ? null : Math.min(selectedImageIndex!, remaining.length - 1));
            setSlipway(updatedSlipway);
            setEditedSlipway(updatedSlipway);
            onSaved?.(updatedSlipway);
        } catch (archiveError) {
            console.error('Error removing photo:', archiveError);
            alert('Could not remove the photo. Please try again.');
        } finally {
            setArchiving(false);
        }
    };

    const handleFacilitiesChange = (text: string) => {
        setFacilitiesText(text);
        const facilities = text.split(',').map(f => f.trim()).filter(f => f);
        handleFieldChange('facilities', facilities);
    };

    // Keyboard navigation for the photo lightbox
    useEffect(() => {
        if (selectedImageIndex === null) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeImageModal();
            if (e.key === 'ArrowLeft') navigateImage('prev');
            if (e.key === 'ArrowRight') navigateImage('next');
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    });

    const isModal = variant === 'modal';

    const copyCoordinates = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // Fallback for browsers without the async clipboard API
            const el = document.createElement('textarea');
            el.value = text;
            el.setAttribute('readonly', '');
            el.style.position = 'fixed';
            el.style.opacity = '0';
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
        }
        setCoordsCopied(true);
        setTimeout(() => setCoordsCopied(false), 2000);
    };
    const close = () => onNavigate && onNavigate('map', { refreshData: true });

    if (loading) {
        return (
            <div className="center-state">
                <span className="spinner spinner--lg" style={{ color: 'var(--primary)' }} />
                <span>Loading slipway details…</span>
            </div>
        );
    }

    if (error && !slipway) {
        return (
            <div className="center-state">
                <AlertIcon size="lg" />
                <h2>Couldn't load this slipway</h2>
                <p>{error}</p>
                <button onClick={() => onNavigate && onNavigate('map')} className="btn btn--primary">
                    <ArrowLeftIcon /> Back to map
                </button>
            </div>
        );
    }

    if (!slipway) return null;

    const known = (v?: string) => !!v && v.trim() !== '' && v !== 'Unknown';
    const websiteHref = slipway.website
        ? (slipway.website.startsWith('http') ? slipway.website : `https://${slipway.website}`)
        : '';

    const fact = (icon: React.ReactNode, label: string, value?: string) => (
        <div className="fact">
            <div className="fact-label">{icon}{label}</div>
            <div className={`fact-value ${known(value) ? '' : 'is-empty'}`}>{known(value) ? value : 'Not specified'}</div>
        </div>
    );

    const row = (label: string, rawValue: React.ReactNode, empty = 'Not provided') => {
        const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
        return (
        <div className="detail-row">
            <dt>{label}</dt>
            <dd className={value ? '' : 'is-empty'}>{value || empty}</dd>
        </div>
        );
    };

    const areaOptions = ['Harbour', 'Shingle', 'Concrete', 'Sand', 'Rock', 'Mud'];

    return (
        <div className="sv">
            {/* Header */}
            <div className="sv-header">
                <div className="sv-heading">
                    {isEditing ? (
                        <label className="field">
                            <span className="field-label">Slipway name</span>
                            <input
                                className="input input--title"
                                type="text"
                                value={editedSlipway?.name || ''}
                                onChange={(e) => handleFieldChange('name', e.target.value)}
                            />
                        </label>
                    ) : (
                        <>
                            <h1 className="sv-title">{slipway.name}</h1>
                            <div className="sv-subtitle">
                                {known(slipway.nearestPlace) && <span><PinIcon size="sm" />{slipway.nearestPlace}</span>}
                                {imageUrls.length > 0 && <span><CameraIcon size="sm" />{imageUrls.length} photo{imageUrls.length !== 1 ? 's' : ''}</span>}
                            </div>
                        </>
                    )}
                </div>
                <div className="btn-row">
                    {!isEditing && (
                        <button onClick={handleEdit} className="btn btn--secondary">
                            <EditIcon size="sm" /> Edit
                        </button>
                    )}
                    {isModal ? (
                        <button onClick={close} className="btn btn--secondary btn--icon" aria-label="Close">
                            <XIcon />
                        </button>
                    ) : (
                        <button onClick={close} className="btn btn--secondary">
                            <ArrowLeftIcon size="sm" /> Map
                        </button>
                    )}
                </div>
            </div>

            {error && <div className="alert alert--error" role="alert"><AlertIcon />{error}</div>}

            {isEditing ? (
                <>
                    <div className="sv-section">
                        <div className="form">
                            <fieldset className="form-section">
                                <h3 className="form-section-title">Overview</h3>
                                <div className="form-grid">
                                    <label className="field field--full">
                                        <span className="field-label">Description</span>
                                        <textarea
                                            className="textarea"
                                            value={editedSlipway?.description || ''}
                                            onChange={(e) => handleFieldChange('description', e.target.value)}
                                            placeholder="What's this slipway like?"
                                        />
                                    </label>
                                    <label className="field">
                                        <span className="field-label">Nearest place</span>
                                        <input className="input" type="text" value={editedSlipway?.nearestPlace || ''}
                                            onChange={(e) => handleFieldChange('nearestPlace', e.target.value)} placeholder="Town or landmark" />
                                    </label>
                                    <label className="field">
                                        <span className="field-label">Charges</span>
                                        <input className="input" type="text" value={editedSlipway?.charges || ''}
                                            onChange={(e) => handleFieldChange('charges', e.target.value)} placeholder="e.g. Free, £5 per launch" />
                                    </label>
                                    <label className="field field--full">
                                        <span className="field-label">Facilities</span>
                                        <input className="input" type="text" value={facilitiesText}
                                            onChange={(e) => handleFacilitiesChange(e.target.value)} placeholder="Parking, Toilets, Café" />
                                        <span className="field-hint">Separate each facility with a comma</span>
                                    </label>
                                </div>
                            </fieldset>

                            <fieldset className="form-section">
                                <h3 className="form-section-title">The ramp</h3>
                                <div className="form-grid">
                                    <label className="field">
                                        <span className="field-label">Suitability</span>
                                        <select className="select" value={editedSlipway?.suitability || ''}
                                            onChange={(e) => handleFieldChange('suitability', e.target.value)}>
                                            <option value="">Select…</option>
                                            <option value="Large trailer needs a car">Large trailer needs a car</option>
                                            <option value="Small trailer can be pushed">Small trailer can be pushed</option>
                                            <option value="Portable Only">Portable Only</option>
                                        </select>
                                    </label>
                                    <label className="field">
                                        <span className="field-label">Ramp length</span>
                                        <select className="select" value={editedSlipway?.rampLength || ''}
                                            onChange={(e) => handleFieldChange('rampLength', e.target.value)}>
                                            <option value="">Select…</option>
                                            <option value="All of tidal range">All of tidal range</option>
                                            <option value="3/4 tidal">3/4 tidal</option>
                                            <option value="1/2 tidal">1/2 tidal</option>
                                            <option value="1/4 tidal">1/4 tidal</option>
                                            <option value="Non-tidal">Non-tidal</option>
                                        </select>
                                    </label>
                                    <label className="field">
                                        <span className="field-label">Ramp type</span>
                                        <input className="input" type="text" value={editedSlipway?.rampType || ''}
                                            onChange={(e) => handleFieldChange('rampType', e.target.value)} placeholder="e.g. Concrete, Shingle" />
                                    </label>
                                    <div className="field" />
                                    <label className="field">
                                        <span className="field-label">Upper area</span>
                                        <select className="select" value={editedSlipway?.upperArea || ''}
                                            onChange={(e) => handleFieldChange('upperArea', e.target.value)}>
                                            <option value="">Select…</option>
                                            {areaOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </label>
                                    <label className="field">
                                        <span className="field-label">Lower area</span>
                                        <select className="select" value={editedSlipway?.lowerArea || ''}
                                            onChange={(e) => handleFieldChange('lowerArea', e.target.value)}>
                                            <option value="">Select…</option>
                                            {areaOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </label>
                                    <label className="field field--full">
                                        <span className="field-label">Ramp description</span>
                                        <textarea className="textarea" value={editedSlipway?.rampDescription || ''}
                                            onChange={(e) => handleFieldChange('rampDescription', e.target.value)} placeholder="Surface, gradient, condition…" />
                                    </label>
                                    <label className="field field--full">
                                        <span className="field-label">Navigational hazards</span>
                                        <textarea className="textarea" value={editedSlipway?.navigationalHazards || ''}
                                            onChange={(e) => handleFieldChange('navigationalHazards', e.target.value)} placeholder="Rocks, currents, moorings…" />
                                    </label>
                                </div>
                            </fieldset>

                            <fieldset className="form-section">
                                <h3 className="form-section-title">Access & contact</h3>
                                <div className="form-grid">
                                    <label className="field field--full">
                                        <span className="field-label">Directions</span>
                                        <textarea className="textarea" value={editedSlipway?.directions || ''}
                                            onChange={(e) => handleFieldChange('directions', e.target.value)} placeholder="How to find the slipway" />
                                    </label>
                                    <label className="field">
                                        <span className="field-label">Email</span>
                                        <input className="input" type="email" inputMode="email" value={editedSlipway?.email || ''}
                                            onChange={(e) => handleFieldChange('email', e.target.value)} />
                                    </label>
                                    <label className="field">
                                        <span className="field-label">Phone</span>
                                        <input className="input" type="tel" inputMode="tel" value={editedSlipway?.mobilePhoneNumber || ''}
                                            onChange={(e) => handleFieldChange('mobilePhoneNumber', e.target.value)} />
                                    </label>
                                    <label className="field field--full">
                                        <span className="field-label">Website</span>
                                        <input className="input" type="url" inputMode="url" value={editedSlipway?.website || ''}
                                            onChange={(e) => handleFieldChange('website', e.target.value)} placeholder="https://" />
                                    </label>
                                </div>
                            </fieldset>
                        </div>
                    </div>

                    <div className="edit-bar">
                        <span>Editing slipway details</span>
                        <div className="btn-row">
                            <button onClick={handleCancel} disabled={saving} className="btn btn--secondary">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="btn btn--primary">
                                {saving ? <><span className="spinner" /> Saving…</> : <><CheckIcon size="sm" /> Save changes</>}
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {slipway.description && slipway.description !== 'No description available' && (
                        <p className="sv-description">{slipway.description.trim()}</p>
                    )}

                    {/* Quick actions – most useful on a phone at the water's edge */}
                    <div className="btn-row sv-actions">
                        <a
                            className="btn btn--primary"
                            href={`https://www.google.com/maps/search/?api=1&query=${slipway.latitude},${slipway.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <MapIcon size="sm" /> Open in Google Maps
                        </a>
                        <a
                            className="btn btn--secondary"
                            href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${slipway.latitude},${slipway.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <StreetViewIcon size="sm" /> Street View
                        </a>
                        {slipway.mobilePhoneNumber && (
                            <a className="btn btn--secondary" href={`tel:${slipway.mobilePhoneNumber}`}>
                                <PhoneIcon size="sm" /> Call
                            </a>
                        )}
                        {websiteHref && (
                            <a className="btn btn--secondary" href={websiteHref} target="_blank" rel="noopener noreferrer">
                                <GlobeIcon size="sm" /> Website
                            </a>
                        )}
                    </div>

                    <div className="sv-facts">
                        {fact(<TruckIcon size="sm" />, 'Suitability', slipway.suitability)}
                        {fact(<RulerIcon size="sm" />, 'Ramp length', slipway.rampLength)}
                        {fact(<LayersIcon size="sm" />, 'Ramp type', slipway.rampType)}
                        {fact(<TagIcon size="sm" />, 'Charges', slipway.charges)}
                    </div>

                    {known(slipway.navigationalHazards) && (
                        <div className="hazard-callout" role="note">
                            <AlertIcon />
                            <div>
                                <strong>Navigational hazards</strong>
                                {slipway.navigationalHazards}
                            </div>
                        </div>
                    )}

                    {slipway.osm && <OsmSourceSection osm={slipway.osm} />}

                    {/* Photos */}
                    <section className="sv-section">
                        <div className="sv-section-head">
                            <h2 className="sv-section-title">
                                Photos <span className="count">{imageUrls.length}</span>
                            </h2>
                            {user && (
                                <>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePhotoUpload}
                                        style={{ display: 'none' }}
                                        id="photo-upload"
                                        disabled={isUploading}
                                    />
                                    <label
                                        htmlFor="photo-upload"
                                        className={`btn btn--secondary btn--sm ${isUploading ? 'is-disabled' : ''}`}
                                        aria-disabled={isUploading}
                                    >
                                        {isUploading
                                            ? <><span className="spinner" /> Uploading {uploadProgress}%</>
                                            : <><UploadIcon size="sm" /> Add photo</>}
                                    </label>
                                </>
                            )}
                        </div>

                        {isUploading && (
                            <div className="upload-progress"><div style={{ width: `${uploadProgress}%` }} /></div>
                        )}

                        {imageUrls.length === 0 ? (
                            <div className="empty-state">
                                <CameraIcon size="lg" />
                                <strong>No photos yet</strong>
                                {user ? (
                                    <span>Been here? Help other boaters by adding a photo.</span>
                                ) : (
                                    <span>
                                        <button className="link-button" onClick={() => onNavigate && onNavigate('signin')}>Sign in</button> to add the first photo.
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="gallery">
                                {imageUrls.map((image, index) => {
                                    const dateLabel = formatPhotoDate(image);
                                    return (
                                        <button
                                            key={image.id}
                                            className="gallery-item"
                                            onClick={() => setSelectedImageIndex(index)}
                                            aria-label={`Open photo ${index + 1} of ${imageUrls.length}${dateLabel ? `, ${dateLabel.toLowerCase()}` : ''}`}
                                        >
                                            <img
                                                src={image.thumbSrc || image.src}
                                                alt={`${slipway.name} (${index + 1} of ${imageUrls.length})`}
                                                loading="lazy"
                                                onError={() => {
                                                    setImageUrls(prev => image.thumbSrc
                                                        // Missing thumbnail: fall back to the full-size photo
                                                        ? prev.map(img => img.id === image.id ? { ...img, thumbSrc: undefined } : img)
                                                        // Drop photos whose S3 object no longer exists rather than showing a placeholder
                                                        : prev.filter(img => img.id !== image.id));
                                                }}
                                            />
                                            {dateLabel && <span className="gallery-item-date">{dateLabel}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* Details */}
                    <div className="sv-columns">
                        <section className="sv-section">
                            <div className="sv-section-head">
                                <h2 className="sv-section-title">The launch</h2>
                            </div>
                            <dl className="detail-list">
                                {row('Ramp', known(slipway.rampDescription) ? slipway.rampDescription : null, 'No description')}
                                {row('Upper area', known(slipway.upperArea) ? slipway.upperArea : null, 'Not specified')}
                                {row('Lower area', known(slipway.lowerArea) ? slipway.lowerArea : null, 'Not specified')}
                                {row('Facilities', slipway.facilities && slipway.facilities.length > 0 ? (
                                    <span className="tag-list">
                                        {slipway.facilities.map((f, i) => <span key={i} className="tag">{f}</span>)}
                                    </span>
                                ) : null, 'None listed')}
                            </dl>
                        </section>

                        <section className="sv-section">
                            <div className="sv-section-head">
                                <h2 className="sv-section-title">Access & contact</h2>
                            </div>
                            <dl className="detail-list">
                                {row('Directions', known(slipway.directions) ? slipway.directions : null)}
                                {row('Email', slipway.email ? <a href={`mailto:${slipway.email}`}>{slipway.email}</a> : null)}
                                {row('Phone', slipway.mobilePhoneNumber ? <a href={`tel:${slipway.mobilePhoneNumber}`}>{slipway.mobilePhoneNumber}</a> : null)}
                                {row('Website', websiteHref ? <a href={websiteHref} target="_blank" rel="noopener noreferrer">{slipway.website}</a> : null)}
                                {row('Coordinates', (
                                    <button
                                        type="button"
                                        className={`copy-chip ${coordsCopied ? 'is-copied' : ''}`}
                                        onClick={() => copyCoordinates(`${slipway.latitude.toFixed(5)}, ${slipway.longitude.toFixed(5)}`)}
                                        title="Copy coordinates"
                                    >
                                        {slipway.latitude.toFixed(5)}, {slipway.longitude.toFixed(5)}
                                        {coordsCopied ? <><CheckIcon size="sm" /> Copied</> : <CopyIcon size="sm" />}
                                    </button>
                                ))}
                                <span className="sr-only" aria-live="polite">{coordsCopied ? 'Coordinates copied' : ''}</span>
                            </dl>
                        </section>
                    </div>

                    {/* Comments wait until promotion so they aren't stranded on the temporary OSM ID */}
                    {!slipway.osm && <SlipwayComments slipwayId={slipwayId} onNavigate={onNavigate} />}

                    <SuggestRemoval slipwayId={slipwayId} slipwayName={slipway.name} onNavigate={onNavigate} />

                    <div className="sv-meta">
                        {slipway.createdBy && slipway.createdAt && (
                            <span>Added by {slipway.createdBy.name} on {formatShortDate(slipway.createdAt)} · </span>
                        )}
                        {slipway.updatedBy && slipway.updatedAt && (
                            <span>Last edited by {slipway.updatedBy.name} on {formatShortDate(slipway.updatedAt)} · </span>
                        )}
                        {slipway.osm ? <>OSM <code>{slipway.osm.osmId}</code></> : <>ID <code>{slipwayId}</code></>}
                    </div>
                </>
            )}

            {/* Photo lightbox */}
            {selectedImageIndex !== null && (
                <div className="lightbox" onClick={(e) => { if (e.target === e.currentTarget) closeImageModal(); }}>
                    <img
                        src={imageUrls[selectedImageIndex]?.src}
                        alt={`${slipway.name} (${selectedImageIndex + 1} of ${imageUrls.length})`}
                        onError={(e) => {
                            // Originals some browsers can't decode (e.g. HEIC) still have a JPEG thumbnail
                            const thumbSrc = imageUrls[selectedImageIndex]?.thumbSrc;
                            if (thumbSrc && e.currentTarget.src !== thumbSrc) e.currentTarget.src = thumbSrc;
                        }}
                    />
                    <button className="lightbox-btn lightbox-btn--close" onClick={closeImageModal} aria-label="Close photo">
                        <XIcon />
                    </button>
                    {user && !slipway.osm && (
                        <button
                            className="lightbox-remove"
                            onClick={handleArchivePhoto}
                            disabled={archiving}
                        >
                            <ArchiveIcon size="sm" /> {archiving ? 'Removing…' : 'Remove photo'}
                        </button>
                    )}
                    {imageUrls.length > 1 && (
                        <>
                            <button className="lightbox-btn lightbox-btn--prev" onClick={() => navigateImage('prev')} aria-label="Previous photo">
                                <ChevronLeftIcon />
                            </button>
                            <button className="lightbox-btn lightbox-btn--next" onClick={() => navigateImage('next')} aria-label="Next photo">
                                <ChevronRightIcon />
                            </button>
                        </>
                    )}
                    <div className="lightbox-counter">
                        {selectedImageIndex + 1} / {imageUrls.length}
                        {imageUrls[selectedImageIndex] && formatPhotoDate(imageUrls[selectedImageIndex]) && (
                            <> · {formatPhotoDate(imageUrls[selectedImageIndex])}</>
                        )}
                        {imageUrls[selectedImageIndex]?.uploadedBy && <> · by {imageUrls[selectedImageIndex].uploadedBy}</>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SlipwayView;
