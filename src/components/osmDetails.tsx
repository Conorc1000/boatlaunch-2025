import React from 'react';
import { OsmSlipway } from '../types/Slipway';
import { GlobeIcon } from './Icons';

const formatDistance = (metres: number) =>
    metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;

// Shown on an OSM import's details view: where it came from and how to make it a Boatlaunch slipway
export const OsmSourceSection: React.FC<{ osm: OsmSlipway }> = ({ osm }) => (
    <section className="sv-section">
        <div className="sv-section-head">
            <h2 className="sv-section-title">
                OpenStreetMap <span className="tag tag--osm">Unverified</span>
            </h2>
            <a className="btn btn--secondary btn--sm" href={osm.osmLink} target="_blank" rel="noopener noreferrer">
                <GlobeIcon size="sm" /> View on OSM
            </a>
        </div>
        <p className="osm-details-meta">
            This slipway comes from OpenStreetMap and hasn't been checked by a Boatlaunch user yet.
            Been here? Edit the details or add a photo and it becomes a full Boatlaunch slipway, with comments.
            {osm.nearestBlName && osm.nearestBlM !== undefined && (
                <> Nearest Boatlaunch slipway: {osm.nearestBlName} ({formatDistance(osm.nearestBlM)}).</>
            )}
        </p>
        <details className="osm-raw-tags">
            <summary>All OSM tags ({Object.keys(osm.tags).length})</summary>
            <dl className="osm-details">
                {Object.entries(osm.tags).sort(([a], [b]) => a.localeCompare(b)).map(([tag, value]) => (
                    <React.Fragment key={tag}>
                        <dt><code>{tag}</code></dt>
                        <dd>{value}</dd>
                    </React.Fragment>
                ))}
            </dl>
        </details>
        <p className="osm-details-meta">
            {osm.lastEdit && <>Last edited in OSM {osm.lastEdit}{osm.lastEditor ? ` by ${osm.lastEditor}` : ''}. </>}
            © OpenStreetMap contributors, ODbL.
        </p>
    </section>
);
