import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for source and destination
const sourceIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [30, 45],
  iconAnchor: [15, 45],
  popupAnchor: [1, -34],
  shadowSize: [45, 45]
});

const destinationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [30, 45],
  iconAnchor: [15, 45],
  popupAnchor: [1, -34],
  shadowSize: [45, 45]
});

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
}

function MapComponent({ onMapClick, sourcePoint, destinationPoint, routePath }) {
 
  const center = [27.18333000, 78.01667000]; 
  
  return (
  <div className="map-container" style={{ height: '100vh', width: '100vw' }}>
  <div className="map-inner" style={{ height: '100%', width: '100%' }}>
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
      scrollWheelZoom={true}
      doubleClickZoom={true}
    >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapClickHandler onMapClick={onMapClick} />
        
        {sourcePoint && (
          <Marker position={[sourcePoint.lat, sourcePoint.lng]} icon={sourceIcon}>
            <Popup>
              <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
                🚩 <strong>Starting Point</strong><br/>
                <small>Lat: {sourcePoint.lat.toFixed(4)}<br/>
                Lng: {sourcePoint.lng.toFixed(4)}</small>
              </div>
            </Popup>
          </Marker>
        )}
        
        {destinationPoint && (
          <Marker position={[destinationPoint.lat, destinationPoint.lng]} icon={destinationIcon}>
            <Popup>
              <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
                🎯 <strong>Destination</strong><br/>
                <small>Lat: {destinationPoint.lat.toFixed(4)}<br/>
                Lng: {destinationPoint.lng.toFixed(4)}</small>
              </div>
            </Popup>
          </Marker>
        )}
        
        {routePath.length > 0 && (
          <Polyline
            positions={routePath.map(point => [point.lat, point.lng])}
            color="blue"
            weight={4}
            opacity={0.7}
          />
        )}
      </MapContainer>
      </div>
    </div>
  );
}

export default MapComponent;