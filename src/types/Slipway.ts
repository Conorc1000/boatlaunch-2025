export interface Comment {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    text: string;
    timestamp: number;
    rating?: number; // Optional 1-5 star rating
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
    comments?: Comment[];
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
