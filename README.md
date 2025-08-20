# Boatlaunch - UK Slipway Database

A comprehensive React application for finding and managing boat launch locations across the UK. Features an interactive map with detailed slipway information, user authentication, and community-driven content.

## Features

- 🗺️ Interactive map powered by React Leaflet with OpenStreetMap tiles
- 🔥 Firebase integration for real-time data and authentication
- 📍 Dynamic slipway markers with detailed popup information
- 🖼️ Photo upload and management for slipways
- 👤 User authentication (Email, Google, Facebook)
- ✏️ Inline editing of slipway details for authenticated users
- 🔍 Modal-based detail view preserving map state
- 📱 Responsive design with modern UI
- 🔧 Full TypeScript support

## Getting Started

### Prerequisites

- Node.js (v18.17.0 or higher)
- npm (v10.5.0 or higher)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Conorc1000/Boatlaunch-2025-Windsurf.git
   cd windsurf-project
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Firebase configuration:
   - Create a `.env` file in the root directory
   - Add your Firebase configuration variables:
   ```
   REACT_APP_FIREBASE_API_KEY=your_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
   REACT_APP_FIREBASE_DATABASE_URL=your_database_url
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
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
│   └── index.html              # HTML template
├── src/
│   ├── components/
│   │   ├── Map.tsx             # Interactive map with modal functionality
│   │   └── SlipwayView.tsx     # Detailed slipway view with inline editing
│   ├── hooks/
│   │   └── useAuth.ts          # Firebase authentication hook
│   ├── services/
│   │   ├── fetchImgService.ts  # Image fetching and validation
│   │   └── imgUploadService.ts # Image upload functionality
│   ├── types/
│   │   └── Slipway.ts          # TypeScript interfaces
│   ├── App.tsx                 # Main application with navigation
│   ├── App.css                 # Application styles
│   ├── firebase.ts             # Firebase configuration
│   ├── index.tsx               # Application entry point
│   ├── index.css               # Global styles
│   └── react-app-env.d.ts      # TypeScript declarations
├── .env                        # Environment variables (not tracked)
├── .gitignore                  # Git ignore rules
├── package.json                # Dependencies and scripts
└── README.md                   # This file
```

## Key Components

### Map Component
- **Interactive Map**: Pan and zoom functionality with state preservation
- **Dynamic Markers**: Firebase-sourced slipway locations with detailed popups
- **Modal Integration**: View details without losing map position
- **Photo Integration**: Display photo counts and quick access

### SlipwayView Component
- **Inline Editing**: Edit slipway details directly in the interface
- **Photo Management**: Upload and manage slipway images
- **User Authentication**: Secure editing for logged-in users
- **Comprehensive Data**: All slipway details including facilities, charges, directions

### Authentication System
- **Multiple Sign-in Options**: Email, Google, and Facebook authentication
- **User Management**: Secure user sessions and permissions
- **Protected Actions**: Editing requires authentication

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm build` - Builds the app for production
- `npm test` - Launches the test runner
- `npm eject` - Ejects from Create React App (one-way operation)

## Technologies Used

- **Frontend**: React 18.2.0 with TypeScript
- **Mapping**: React Leaflet 5.0.0 + Leaflet 1.9.4
- **Backend**: Firebase Realtime Database
- **Authentication**: Firebase Auth (Email, Google, Facebook)
- **Storage**: Firebase Storage for images
- **Build Tool**: Create React App
- **Styling**: CSS with modern responsive design

## Usage

### For Users
1. **Browse Map**: Explore slipway locations across the UK
2. **View Details**: Click "View Details" to see comprehensive information
3. **Sign Up/In**: Create an account to contribute to the database
4. **Edit Information**: Authenticated users can update slipway details
5. **Upload Photos**: Add images to help other boaters

### For Developers
- Slipway data is stored in Firebase Realtime Database
- Images are managed through Firebase Storage
- Authentication handles user permissions
- The app uses TypeScript interfaces for type safety

## Contributing

Contributions are welcome! Please ensure:
- TypeScript compliance
- Proper error handling
- User authentication for data modifications
- Responsive design principles

## License

This project is open source and available under the MIT License.
