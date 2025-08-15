# Slipway Map - React Leaflet Project

A React application featuring an interactive map with slipway markers using React Leaflet and OpenStreetMap tiles.

## Features

- 🗺️ Interactive map powered by React Leaflet
- 📍 Hardcoded slipway markers with popup information
- 🎨 Modern UI with gradient background and rounded corners
- 📱 Responsive design
- 🔧 TypeScript support

## Getting Started

### Prerequisites

- Node.js (v18.17.0 or higher)
- npm (v10.5.0 or higher)

### Installation

1. Clone the repository or navigate to the project directory
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

Start the development server:
```bash
npm start
```

The application will open in your browser at `http://localhost:3000`.

## Project Structure

```
windsurf-project/
├── public/
│   └── index.html          # HTML template
├── src/
│   ├── components/
│   │   └── Map.tsx         # React Leaflet map component
│   ├── App.tsx             # Main application component
│   ├── App.css             # Application styles
│   ├── index.tsx           # Application entry point
│   ├── index.css           # Global styles
│   └── react-app-env.d.ts  # TypeScript declarations
├── package.json            # Dependencies and scripts
└── README.md              # This file
```

## Map Features

- **Interactive Map**: Pan and zoom functionality
- **Markers**: Three sample slipway locations with popups
- **Styling**: 80vh height with rounded corners (10px radius)
- **Icons**: Properly configured Leaflet marker icons

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm build` - Builds the app for production
- `npm test` - Launches the test runner
- `npm eject` - Ejects from Create React App (one-way operation)

## Technologies Used

- React 18.2.0
- TypeScript 4.7.4
- React Leaflet 5.0.0
- Leaflet 1.9.4
- Create React App

## Customization

To add more slipway markers, edit the `slipways` array in `src/components/Map.tsx`:

```typescript
const slipways = [
  {
    position: [latitude, longitude],
    name: 'Your Slipway Name',
    description: 'Your slipway description'
  },
  // Add more markers here
];
```

## License

This project is open source and available under the MIT License.
