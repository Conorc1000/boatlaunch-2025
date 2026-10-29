import React from 'react';
import { CoffeeIcon, CheckIcon } from './Icons';

// REACT_APP_DONATION_URL can override the default Buy Me a Coffee page
const DONATION_URL = process.env.REACT_APP_DONATION_URL || 'https://www.buymeacoffee.com/conorc1000';
const BMC_BUTTON_IMG = 'https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=conorc1000&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff';

const Donate: React.FC = () => (
    <div className="page page--narrow">
        <div className="card center-card">
            <div className="coffee-badge"><CoffeeIcon size="lg" /></div>
            <h1 className="page-title">Buy me a coffee</h1>
            <p className="page-lead">
                Boatlaunch is free, ad-free and run in my spare time. If it’s helped you find a good
                launch, a small donation keeps it going.
            </p>

            <ul className="donate-list">
                <li><CheckIcon size="sm" />Pays for map hosting and photo storage</li>
                <li><CheckIcon size="sm" />Keeps the site free with no ads</li>
                <li><CheckIcon size="sm" />Funds new features and fixes</li>
            </ul>

            <a className="bmc-button" href={DONATION_URL} target="_blank" rel="noopener noreferrer">
                <img src={BMC_BUTTON_IMG} alt="Buy me a coffee" />
            </a>

            <p className="field-hint" style={{ marginTop: 14 }}>
                Payments are handled securely by a third party. Thank you!
            </p>
        </div>
    </div>
);

export default Donate;
