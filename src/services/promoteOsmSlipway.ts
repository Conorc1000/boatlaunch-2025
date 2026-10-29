import { User } from 'firebase/auth';
import { ref, serverTimestamp, update } from 'firebase/database';
import { database } from '../firebase';
import { OsmSlipway, Slipway } from '../types/Slipway';
import { attributionFor } from './attribution';

// Deterministic so the database rules can check that deleting osmSlipways/{id} creates slipwayDetails/osm_{id},
// and so two people promoting the same slipway at once can't create duplicates
export const promotedIdFor = (osm: OsmSlipway) => `osm_${osm.id}`;

// Turns an OSM import into a real Boatlaunch slipway, credited to the user whose edit or photo triggered it.
// One multi-path write: the new slipway, its location and removal of the OSM entry succeed or fail together.
export const promoteOsmSlipway = async (slipway: Slipway, user: User): Promise<Slipway> => {
    const osm = slipway.osm;
    if (!osm) throw new Error('Not an OSM slipway');

    const id = promotedIdFor(osm);
    const createdBy = attributionFor(user);
    const details = {
        Name: slipway.name,
        Description: slipway.description || '',
        RampDescription: slipway.rampDescription || '',
        Facilities: slipway.facilities?.join(', ') || '',
        Charges: slipway.charges || '',
        NearestPlace: slipway.nearestPlace || '',
        RampType: slipway.rampType || '',
        Suitability: slipway.suitability || '',
        Directions: slipway.directions || '',
        Email: slipway.email || '',
        LowerArea: slipway.lowerArea || '',
        MobilePhoneNumber: slipway.mobilePhoneNumber || '',
        NavigationalHazards: slipway.navigationalHazards || '',
        RampLength: slipway.rampLength || '',
        UpperArea: slipway.upperArea || '',
        Website: slipway.website || '',
        imgs: slipway.imgs || [],
        createdBy,
        createdAt: serverTimestamp(),
        // Provenance: OSM data is ODbL-licensed and must stay attributable
        importedFrom: 'OSM',
        osmId: osm.osmId,
        osmLink: osm.osmLink
    };

    await update(ref(database), {
        [`slipwayDetails/${id}`]: details,
        [`latLngs/${id}`]: [slipway.latitude.toString(), slipway.longitude.toString()],
        [`osmSlipways/${osm.id}`]: null
    });

    return { ...slipway, id, source: undefined, osm: undefined, createdBy, createdAt: Date.now() };
};
