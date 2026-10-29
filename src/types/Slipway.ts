import { Attribution } from '../services/attribution';

// Stored at comments/{slipwayId}/{id}
export interface Comment {
    id: string;
    uid: string;
    userName: string;
    text: string;
    createdAt: number; // Server timestamp in ms
}

export interface Slipway {
    id: string;
    name: string;
    description: string;
    latitude: number;
    longitude: number;
    facilities?: string[];
    imageUrl?: string;
    imgs?: string[];
    charges?: string;
    nearestPlace?: string;
    rampType?: string;
    suitability?: string;
    directions?: string;
    email?: string;
    lowerArea?: string;
    mobilePhoneNumber?: string;
    navigationalHazards?: string;
    rampDescription?: string;
    rampLength?: string;
    upperArea?: string;
    website?: string;
    // Only recorded for slipways added or edited since attribution was introduced
    createdBy?: Attribution;
    createdAt?: number;
    updatedBy?: Attribution;
    updatedAt?: number;
    // Set for admin-only OpenStreetMap imports (see osmToSlipway); these are read-only
    source?: 'OSM';
    osm?: OsmSlipway;
}

// Slipways imported from OpenStreetMap that aren't on Boatlaunch yet; stored at osmSlipways/{id}, admin-only
export interface OsmSlipway {
    id: string;
    source: 'OSM';
    osmId: string; // e.g. "node/6604551629"
    osmLink: string;
    latitude: number;
    longitude: number;
    name?: string;
    nearestBlId?: string;
    nearestBlName?: string;
    nearestBlM?: number; // Distance in metres to the nearest Boatlaunch slipway
    lastEdit?: string;
    lastEditor?: string;
    disused?: boolean;
    tags: Record<string, string>; // Raw OSM tags
}
