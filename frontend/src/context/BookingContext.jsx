import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const BookingContext = createContext(null);

const initialState = {
    isDifferentReturn: false,
    pickupCity: null,
    returnCity: null,
    pickupDate: null,
    returnDate: null,
    pickupTime: '',
    returnTime: '',
    selectedSegment: null,       // ← NEW: set by SegmentSelectPage (Step 1)
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
    const update = useCallback((partial) => setBooking((prev) => ({ ...prev, ...partial })), []);
    const reset  = useCallback(() => setBooking(initialState), []);
    const value  = useMemo(() => ({ booking, update, reset }), [booking, update, reset]);
    return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export const useBooking = () => useContext(BookingContext);