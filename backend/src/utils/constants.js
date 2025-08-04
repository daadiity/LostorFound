// Road type weights for routing calculations
// Lower values = faster/preferred roads
const ROAD_TYPE_WEIGHTS = {
  'motorway': 1.0,      // Fastest roads (highways)
  'trunk': 1.2,         // Major highways
  'primary': 1.5,       // Major roads
  'secondary': 2.0,     // Important roads
  'tertiary': 2.5,      // Local connecting roads
  'residential': 3.0,   // Neighborhood streets
  'unclassified': 3.5,  // Minor roads
  'default': 2.0        // Fallback for unknown road types
};

// Average speeds for different road types (km/h)
const AVERAGE_SPEEDS = {
  'motorway': 90,
  'trunk': 70,
  'primary': 60,
  'secondary': 50,
  'tertiary': 40,
  'residential': 30,
  'unclassified': 25,
  'default': 40
};

// Maximum distance to consider roads "connected" at intersections (in km)
const INTERSECTION_TOLERANCE = 0.001; // ~1 meter

module.exports = {
  ROAD_TYPE_WEIGHTS,
  AVERAGE_SPEEDS,
  INTERSECTION_TOLERANCE
};
