export interface Host {
  _id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  role: string;
  verified: boolean;
  superhost: boolean;
  rating: number;
  reviewsCount: number;
  responseTime: string;
  memberSince: string;
  bio: string;
}

export interface Review {
  _id: string;
  chalet: string;
  authorName: string;
  authorAvatar?: string;
  rating: number;
  cleanliness: number;
  accuracy?: number;
  location: number;
  communication: number;
  value: number;
  comment: string;
  date: string;
}

export interface RatingBreakdown {
  cleanliness: number;
  accuracy: number;
  communication: number;
  location: number;
  value: number;
}

export interface BookedDateRange {
  _id: string;
  checkIn: string;
  checkOut: string;
  status: 'confirmada' | 'pendiente';
}

export interface Chalet {
  _id: string;
  title: string;
  category: 'Lago' | 'Playa' | 'Montaña' | 'Colonial' | 'Selva' | 'Ecológico';
  department: string;
  municipality: string;
  location: string[];
  description: string;
  pricePerNight: number;
  priceUSD: number;
  cleaningFee?: number;
  deposit?: number;
  rating: number;
  reviewsCount: number;
  ratingBreakdown?: RatingBreakdown;
  guestsMax: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  images: string[];
  thumbnail: string;
  amenities: string[];
  rules?: string[];
  coordinates: {
    lat: number;
    lng: number;
  };
  host: Host;
  featured: boolean;
  status?: 'disponible' | 'reservado' | 'mantenimiento' | string;
  reviews?: Review[];
  bookedDates?: BookedDateRange[];
  distance?: number;
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
  checkIn?: string;
  checkOut?: string;
  sort?: string;
}

export interface BookingPayload {
  chaletId: string;
  bookingType?: 'reserva' | 'cita';
  visitTime?: string;
  status?: 'confirmada' | 'pendiente';
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut?: string;
  guestsCount: number;
  notes?: string;
}

export interface BookingItem {
  _id: string;
  bookingType?: 'reserva' | 'cita';
  visitTime?: string;
  guest?: Partial<Host> & { _id: string; name: string; email?: string; phone?: string; avatar?: string };
  chalet?: Omit<Partial<Chalet>, 'host'> & {
    _id: string;
    title: string;
    host?: Partial<Host> & { _id: string; name: string; email?: string; phone?: string; avatar?: string };
  };
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  nights: number;
  totalPriceGTQ: number;
  notes?: string;
  status: 'confirmada' | 'pendiente' | 'cancelada';
  createdAt?: string;
}
