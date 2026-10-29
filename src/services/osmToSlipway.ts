import { OsmSlipway, Slipway } from '../types/Slipway';

// "paving_stones" -> "Paving stones", "cable_winch;by car" -> "Cable winch, by car"
const readable = (value?: string) => {
    if (!value) return '';
    const text = value.replace(/_/g, ' ').replace(/;\s*/g, ', ').trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
};

const isYes = (value?: string) => !!value && /^(yes|designated|permissive|put_in)$/.test(value);

// Only claims a suitability when OSM says something explicit about trailers or craft
const suitabilityFrom = (osm: OsmSlipway): string => {
    const { tags } = osm;
    const name = `${osm.name || ''}`.toLowerCase();
    if (tags.trailer === 'yes' || /by car/i.test(tags['seamark:information'] || '')) return 'Large trailer needs a car';
    if (tags.trailer === 'no' || ((isYes(tags.canoe) || /canoe|kayak/.test(name)) && tags.trailer !== 'yes')) return 'Portable Only';
    return '';
};

const chargesFrom = ({ tags }: OsmSlipway): string => {
    if (tags.fee === 'no') return 'Free';
    if (tags.fee === 'yes') return tags.charge ? `Launch fee (${tags.charge})` : 'Launch fee';
    return tags.charge || '';
};

const rampDescriptionFrom = ({ tags }: OsmSlipway): string => {
    const parts = [
        tags.incline && /\d/.test(tags.incline) ? `${tags.incline} incline` : '',
        tags.width ? `${tags.width} m wide` : '',
        tags.smoothness ? `${readable(tags.smoothness).toLowerCase()} surface` : '',
        tags.material ? `made of ${readable(tags.material).toLowerCase()}` : '',
        tags.floating === 'yes' ? 'floating' : '',
        tags.operating ? readable(tags.operating).toLowerCase() : '',
        tags['seamark:information'] ? readable(tags['seamark:information']).toLowerCase() : '',
        tags.maxweight ? `max weight ${tags.maxweight} t` : '',
        tags.maxload ? `max load ${tags.maxload}` : ''
    ].filter(Boolean);
    return parts.length ? readable(parts.join(', ')) : '';
};

const ACCESS_TEXT: Record<string, string> = {
    no: 'No public access.',
    private: 'Private access.',
    permit: 'Permit required.',
    permissive: 'Access with permission of the owner.',
    customers: 'Customers only.',
    members: 'Members only.',
    destination: 'Access for local traffic only.'
};

const descriptionFrom = ({ tags }: OsmSlipway): string => [
    tags.description || tags.note || '',
    tags.operator ? `Operated by ${tags.operator}.` : '',
    tags.access && tags.access !== 'yes'
        ? ACCESS_TEXT[tags.access] || `Access: ${readable(tags.access).toLowerCase()}.`
        : ''
].filter(Boolean).join(' ');

// Presents an OSM import in Boatlaunch's own fields so it can reuse the normal popup and details view
export const osmToSlipway = (osm: OsmSlipway): Slipway => ({
    id: `osm:${osm.id}`, // Prefixed so it can't collide with a Boatlaunch slipway ID
    source: 'OSM',
    osm,
    name: osm.name || osm.tags['seamark:name'] || osm.tags.alt_name || 'Unnamed slipway',
    description: descriptionFrom(osm),
    latitude: osm.latitude,
    longitude: osm.longitude,
    facilities: [
        osm.tags.lit === 'yes' ? 'Lit' : '',
        isYes(osm.tags.wheelchair) ? 'Wheelchair access' : ''
    ].filter(Boolean),
    imgs: [],
    charges: chargesFrom(osm),
    nearestPlace: osm.tags['addr:city'] || '',
    rampType: readable(osm.tags.surface),
    suitability: suitabilityFrom(osm),
    rampLength: osm.tags.tidal === 'no' ? 'Non-tidal' : '',
    rampDescription: rampDescriptionFrom(osm),
    navigationalHazards: osm.disused ? 'Marked as disused or abandoned in OpenStreetMap.' : '',
    website: osm.tags.website || '',
    directions: '',
    email: '',
    mobilePhoneNumber: '',
    lowerArea: '',
    upperArea: ''
});
