/** Shared Google Maps loader options. useJsApiLoader must receive this same object everywhere. */
export const GOOGLE_MAPS_API_KEY = 'AIzaSyBwSjsnX7tDra6Wz5mw6wZRwRN57pi0NUM'

export const GOOGLE_MAPS_LIBRARIES = ['places', 'geometry'] as ('places' | 'geometry')[]

export const googleMapsLoaderOptions = {
  id: 'tastykart-google-maps',
  googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  libraries: GOOGLE_MAPS_LIBRARIES,
}
