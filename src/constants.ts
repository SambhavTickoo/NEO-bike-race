/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const COLORS = {
  background: '#1a140f', // Dusty dark brown
  ground: '#2c1e14', // Earthy brown
  road: '#1a1a1a', // Asphalt
  marking: '#f3f1e7', // Off-white
  primary: '#ff4400', // Saffron/Orange
  secondary: '#22c55e', // Green (Tri-color theme)
  accent: '#ff9900', // Duke Orange
  coin: '#ffd700',
  grid: '#ffffff05',
  text: '#ffffff',
  ghost: 'rgba(255, 255, 255, 0.1)',
};

export const BIKE_TYPES = {
  STANDARD: {
    name: 'Cruiser',
    color: '#ff00ff',
    speed: 0.15,
    torque: 0.1,
    weight: 0.001,
    scale: 1,
  },
  DUKE: {
    name: 'Duke 390',
    color: '#ff9900',
    speed: 0.22, // Faster
    torque: 0.12,
    weight: 0.0008, // Lighter
    scale: 0.9,
  }
};

export const PHYSICS_CONFIG = {
  gravity: 1.0,
  wheelFriction: 0.95,
  wheelRestitution: 0.1,
  airRotationSpeed: 0.1, // Faster rotations for stunts
  fuelConsumption: 0.15,
  fuelGain: 40,
  maxFuel: 100,
};

export const TRACK_WIDTH = 50000;
