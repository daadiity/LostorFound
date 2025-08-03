import React, { useState } from 'react';
import MapComponent from './MapComponent.jsx';
import axios from 'axios';
import './App.css';

function App() {
  const[sourcePoint, setSourcePoint] = useState(null);
  const[destinationPoint, setDestinationPoint] = useState(null);
 
  const [routePath, setRoutePath] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleMapClick = (latlng) => {
    if (!sourcePoint) {
      setSourcePoint(latlng);
    } else if (!destinationPoint) {
      setDestinationPoint(latlng);
    }
  };

  const calculateRoute = async () => {
    if (!sourcePoint || !destinationPoint) {
      alert('Please select both source and destination points');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post('http://localhost:3000/api/route', {
        source: sourcePoint,
        destination: destinationPoint
      });
      
      setRoutePath(response.data.path);
    } catch (error) {
      console.error('Error calculating route:', error);
      alert('Failed to calculate route');
    } finally {
      setIsLoading(false);
    }
  };

  const resetPoints = () => {
    setSourcePoint(null);
    setDestinationPoint(null);
    setRoutePath([]);
  };

  return (
    <div className="App">
      <h1>Route Finder</h1>
      
      <div className="controls">
        <div className="points-info">
          <p>Source: {sourcePoint ? `${sourcePoint.lat.toFixed(4)}, ${sourcePoint.lng.toFixed(4)}` : 'Not selected'}</p>
          <p>Destination: {destinationPoint ? `${destinationPoint.lat.toFixed(4)}, ${destinationPoint.lng.toFixed(4)}` : 'Not selected'}</p>
        </div>
        
        <div className="buttons">
          <button 
            onClick={calculateRoute} 
            disabled={!sourcePoint || !destinationPoint || isLoading}
          >
            {isLoading ? 'Calculating...' : 'Find Route'}
          </button>
          <button onClick={resetPoints}>Reset</button>
        </div>
      </div>

      <MapComponent
        onMapClick={handleMapClick}
        sourcePoint={sourcePoint}
        destinationPoint={destinationPoint}
        routePath={routePath}
      />
    </div>
  );
}

export default App;