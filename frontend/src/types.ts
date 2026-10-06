export interface UserProfile {
  name: string;
  email: string;
  number: string;
  age: number;
  dob: string;
  photoUrl: string;
}

export enum BookingType {
  MOVIE = "movie",
  HOTEL = "hotel",
  BUS = "bus",
}

export interface MovieDetails {
  movieName: string;
  theatreName: string;
  showtime: string;
  seats: string[];
}

export interface HotelDetails {
  hotelName: string;
  roomType: "AC" | "Non-AC";
  roomNumber: string;
  checkInDate: string;
  checkOutDate: string;
}

export interface BusDetails {
  busOperator: string;
  source: string;
  destination: string;
  busType: string;
  seats: string[];
  departureDate: string;
}

export interface Booking {
  id: string;
  userId: string;
  type: BookingType;
  title: string;
  date: string;
  price: number;
  status: "Success" | "Failed" | "Pending";
  details: MovieDetails | HotelDetails | BusDetails;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  bookingId: string;
  type: BookingType;
  title: string;
  amount: number;
  paymentMethod: string;
  status: "Success" | "Failed";
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  interactiveAction?: {
    type: "select_movie_seats" | "select_bus_seats" | "select_hotel_options" | "trigger_payment" | "ticket_issued" | "show_results";
    data: any;
  };
}

export interface EmailMessage {
  id: string;
  to: string;
  subject: string;
  body: string;
  type: "otp" | "ticket";
  ticketId?: string;
  createdAt: string;
}

export interface PartnerData {
  movies: {
    id: string;
    title: string;
    theatres: string[];
    showtimes: string[];
    price: number;
  }[];
  hotels: {
    id: string;
    name: string;
    pricePerNight: number;
    availableRooms: string[];
  }[];
  buses: {
    id: string;
    operator: string;
    routes: { source: string; destination: string; price: number; departureTimes: string[] }[];
  }[];
}

export interface UserLocation {
  lat: number;
  lng: number;
  city: string;
  display?: string;
  source: "gps" | "manual";
}
