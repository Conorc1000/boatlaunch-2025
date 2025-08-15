export interface Slipway {
    id: string;
    name: string;
    description: string;
    latitude: number;
    longitude: number;
    facilities?: string[];
    imageUrl?: string;
    // Additional fields from Firebase data structure
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
}
