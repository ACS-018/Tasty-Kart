import { useState, useCallback, useRef, useEffect } from 'react'
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api'
import { Search, MapPin, Loader2, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { googleMapsLoaderOptions } from '@/lib/googleMaps'

const DEFAULT_CENTER = { lat: 17.385044, lng: 78.486671 } // Hyderabad
const DEFAULT_ZOOM = 15

interface LocationData {
  latitude: number
  longitude: number
  address: string
  placeId?: string
}

interface GoogleMapPickerProps {
  initialLocation?: LocationData
  onLocationSelect: (location: LocationData) => void
  onCancel: () => void
}

export function GoogleMapPicker({ initialLocation, onLocationSelect, onCancel }: GoogleMapPickerProps) {
  const [markerPosition, setMarkerPosition] = useState(
    initialLocation
      ? { lat: initialLocation.latitude, lng: initialLocation.longitude }
      : DEFAULT_CENTER
  )
  const [address, setAddress] = useState(initialLocation?.address || '')
  const [isGeocodingLoading, setIsGeocodingLoading] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  const mapRef = useRef<google.maps.Map | null>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  const { isLoaded, loadError } = useJsApiLoader(googleMapsLoaderOptions)

  // Reverse geocode to get address from lat/lng
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsGeocodingLoading(true)
    try {
      const geocoder = new google.maps.Geocoder()
      const result = await geocoder.geocode({ location: { lat, lng } })
      
      if (result.results && result.results.length > 0) {
        const place = result.results[0]
        setAddress(place.formatted_address)
        return place.formatted_address
      }
      return ''
    } catch (error) {
      console.error('Reverse geocoding error:', error)
      return ''
    } finally {
      setIsGeocodingLoading(false)
    }
  }, [])

  // Handle map click
  const onMapClick = useCallback(
    async (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const lat = e.latLng.lat()
        const lng = e.latLng.lng()
        setMarkerPosition({ lat, lng })
        await reverseGeocode(lat, lng)
      }
    },
    [reverseGeocode]
  )

  // Handle marker drag
  const onMarkerDragEnd = useCallback(
    async (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const lat = e.latLng.lat()
        const lng = e.latLng.lng()
        setMarkerPosition({ lat, lng })
        await reverseGeocode(lat, lng)
      }
    },
    [reverseGeocode]
  )

  // Handle place selection from autocomplete
  const onPlaceChanged = useCallback(() => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace()
      
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat()
        const lng = place.geometry.location.lng()
        
        setMarkerPosition({ lat, lng })
        setAddress(place.formatted_address || '')
        
        // Center map on selected place
        if (mapRef.current) {
          mapRef.current.panTo({ lat, lng })
          mapRef.current.setZoom(16)
        }
      }
    }
  }, [])

  // Get current location
  const handleMyLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          
          setMarkerPosition({ lat, lng })
          await reverseGeocode(lat, lng)
          
          if (mapRef.current) {
            mapRef.current.panTo({ lat, lng })
            mapRef.current.setZoom(16)
          }
        },
        (error) => {
          console.error('Geolocation error:', error)
          alert('Unable to get your location. Please check browser permissions.')
        }
      )
    } else {
      alert('Geolocation is not supported by your browser.')
    }
  }, [reverseGeocode])

  // Confirm selection
  const handleConfirm = useCallback(() => {
    if (!address) {
      alert('Please select a valid location with an address.')
      return
    }

    onLocationSelect({
      latitude: markerPosition.lat,
      longitude: markerPosition.lng,
      address,
    })
  }, [markerPosition, address, onLocationSelect])

  // Initial reverse geocode if location provided but no address
  useEffect(() => {
    if (initialLocation && !initialLocation.address && isLoaded) {
      reverseGeocode(initialLocation.latitude, initialLocation.longitude)
    }
  }, [initialLocation, isLoaded, reverseGeocode])

  if (loadError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-medium">Error loading Google Maps</p>
        <p className="text-sm text-gray-500 mt-2">Please check your API key and try again.</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="animate-spin text-[#B32B2C]" />
        <span className="ml-3 text-gray-600">Loading Google Maps...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Autocomplete
          onLoad={(autocomplete) => (autocompleteRef.current = autocomplete)}
          onPlaceChanged={onPlaceChanged}
          options={{
            componentRestrictions: { country: 'in' },
            fields: ['formatted_address', 'geometry', 'place_id'],
          }}
        >
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search for a location..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-[#B32B2C] focus:outline-none text-sm"
            />
          </div>
        </Autocomplete>
      </div>

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border-2 border-gray-200">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '400px' }}
          center={markerPosition}
          zoom={DEFAULT_ZOOM}
          onClick={onMapClick}
          onLoad={(map) => { mapRef.current = map }}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
        >
          <Marker
            position={markerPosition}
            draggable={true}
            onDragEnd={onMarkerDragEnd}
          />
        </GoogleMap>

        {/* My Location Button */}
        <button
          onClick={handleMyLocation}
          className="absolute bottom-4 right-4 p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow border border-gray-200"
          title="My Location"
        >
          <Navigation size={20} className="text-[#B32B2C]" />
        </button>
      </div>

      {/* Selected Address Display */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <div className="flex items-start gap-3">
          <MapPin size={20} className="text-[#B32B2C] mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Selected Location
            </p>
            {isGeocodingLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-gray-400" />
                <span className="text-sm text-gray-500">Getting address...</span>
              </div>
            ) : address ? (
              <p className="text-sm text-gray-900 font-medium">{address}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">Click on map or search to select location</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {markerPosition.lat.toFixed(6)}, {markerPosition.lng.toFixed(6)}
            </p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
        <p className="text-xs text-blue-700">
          <strong>Tip:</strong> You can search for a location, click on the map, or drag the red marker to select the exact restaurant location.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end pt-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleConfirm}
          disabled={!address || isGeocodingLoading}
          icon={<MapPin size={16} />}
        >
          Confirm Location
        </Button>
      </div>
    </div>
  )
}
