import React, { createContext, useContext, useState } from 'react';

const BookingContext = createContext(null);

const initialState = {
    isDifferentReturn: false,
    pickupCity: null,
    returnCity: null,
    pickupDate: null,
    returnDate: null,
    pickupTime: '',
    returnTime: '',
    selectedModel: null,
    selectedVehicle: null,
    pickupLocation: null,
    pickupVendor: null,
    returnLocation: null,
    returnVendor: null,
    selectedAddons: [],
    promoCode: '',
    promoDiscount: 0,
    oneWayFee: 0,
    pricingBreakdown: null,
    bookingId: null,
    bookingRef: null,
};

export function BookingProvider({ children }) {
    const [booking, setBooking] = useState(initialState);
    const update = (partial) => setBooking((prev) => ({ ...prev, ...partial }));
    const reset = () => setBooking(initialState);
    return (
        <BookingContext.Provider value={{ booking, update, reset }}>
            {children}
        </BookingContext.Provider>
    );
}

export const useBooking = () => useContext(BookingContext);