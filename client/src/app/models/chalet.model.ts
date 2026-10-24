export interface Host {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar: string;
  role: string;
  verified: boolean;
  superhost: boolean;
  rating: number;
  reviewsCount?: number;
  responseTime: string;
  memberSince: string;
  bio?: string;
}

export interface RatingBreakdown {
  cleanliness: number;
  accuracy: number;
  communication: number;
  location: number;
  value: number;
}

export interface Review {
  _id?: string;
  chalet: string;
  authorName: string;
  authorAvatar?: string;
  rating: number;
  comment: string;
  cleanliness?: number;
  location?: number;
  communication?: number;
  value?: number;
  date?: string | Date;
}

export interface Chalet {
  _id: string;
  title: string;
  category: 'Lago' | 'Playa' | 'Montaña' | 'Colonial' | 'Selva' | 'Río' | string;
  department: string;
  municipality: string;
  location: string[];
  description: string;
  pricePerNight: number;
  priceUSD?: number;
  deposit?: number;
  cleaningFee?: number;
  guestsMax: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  images: string[];
  thumbnail: string;
  rating: number;
  reviewsCount: number;
  ratingBreakdown?: RatingBreakdown;
  amenities: string[];
  rules: string[];
  host: Host;
  featured?: boolean;
  status: 'disponible' | 'reservado' | 'mantenimiento' | string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  reviews?: Review[];
  createdAt?: string;
}

export interface FilterParams {
  search?: string;
  department?: string;
  municipality?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  guests?: number;
  minRating?: number;
  amenities?: string;
  sort?: string;
}

export interface BookingPayload {
  chaletId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  notes?: string;
}
