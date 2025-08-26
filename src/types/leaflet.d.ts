declare module 'leaflet' {
  export type LatLngExpression = [number, number] | { lat: number; lng: number };
  export interface LatLng {
    lat: number;
    lng: number;
  }
  export interface Map {
    // Add other Map methods as needed
  }
  export interface Icon {
    // Add Icon properties as needed
  }
  export interface Marker {
    options: any;
    // Add other Marker properties as needed
  }
  const L: {
    icon: (options: any) => Icon;
    map: (element: string | HTMLElement, options?: any) => Map;
    marker: (latlng: LatLngExpression, options?: any) => Marker;
    Marker: {
      prototype: Marker;
    };
    // Add other L methods as needed
  };
  export default L;
}
