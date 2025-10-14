import { useRef, useEffect, useState } from 'react';
import type { Location } from '@/types';

interface LocationSearchProps {
  label: string;
  placeholder: string;
  onLocationSelect: (location: Location) => void;
  disabled?: boolean;
  onRemove?: () => void;
  showRemove?: boolean;
}

export default function LocationSearch({ 
  label, 
  placeholder, 
  onLocationSelect,
  disabled = false,
  onRemove,
  showRemove = false
}: LocationSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  useEffect(() => {
    if (!inputRef.current || !window.google) return;

    // Initialize autocomplete
    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'geometry', 'name'],
      types: ['geocode', 'establishment']
    });

    // Listen for place selection
    const listener = autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      
      if (place?.geometry?.location) {
        const location: Location = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: place.formatted_address || place.name || ''
        };
        onLocationSelect(location);
      }
    });

    // Apply custom styling to Google Places dropdown
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      .pac-container {
        background-color: #1f2937 !important;
        border: 1px solid #374151 !important;
        border-radius: 0.5rem !important;
        margin-top: 0.5rem !important;
        box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3) !important;
        font-family: inherit !important;
      }
      
      .pac-item {
        background-color: #1f2937 !important;
        border-top: 1px solid #374151 !important;
        padding: 0.75rem 1rem !important;
        cursor: pointer !important;
        color: #e5e7eb !important;
        font-size: 0.875rem !important;
        line-height: 1.5 !important;
      }
      
      .pac-item:hover {
        background-color: #374151 !important;
      }
      
      .pac-item-selected {
        background-color: #374151 !important;
      }
      
      .pac-item-query {
        color: #ffffff !important;
        font-weight: 600 !important;
      }
      
      .pac-matched {
        color: #60a5fa !important;
        font-weight: 700 !important;
      }
      
      .pac-icon {
        display: none !important;
      }
      
      .pac-logo:after {
        display: none !important;
      }
    `;
    document.head.appendChild(styleSheet);

    return () => {
      if (listener) {
        google.maps.event.removeListener(listener);
      }
      document.head.removeChild(styleSheet);
    };
  }, [onLocationSelect]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // Use coordinates directly without geocoding to avoid API permission issues
        const address = `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        const location: Location = {
          lat,
          lng,
          address
        };
        
        if (inputRef.current) {
          inputRef.current.value = address;
        }
        
        onLocationSelect(location);
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to get your location. Please check permissions.');
        setIsGettingLocation(false);
      }
    );
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-200">
          {label}
        </label>
        {showRemove && onRemove && !disabled && (
          <button
            type="button"
            onClick={onRemove}
            className="text-red-400 hover:text-red-300 transition-colors p-1 hover:bg-red-400/10 rounded"
            title="Remove stopover"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-4 pr-12 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={disabled || isGettingLocation}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-700 text-gray-400 hover:text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          title="Use current location"
        >
          {isGettingLocation ? (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
